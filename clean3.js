#!/usr/bin/env node

const ts = require('typescript');
const fs = require('fs');
const path = require('path');

// AST Transformer
function createTransformer() {
    return (context) => {
        const visit = (node) => {
            // Transform if statements
            if (ts.isIfStatement(node)) {
                const thenStatement = node.thenStatement;
                if (ts.isBlock(thenStatement) && thenStatement.statements.length === 1) {
                    const singleStatement = thenStatement.statements[0];
                    // Handle both return statements and expressions (like assignments)
                    if (ts.isExpressionStatement(singleStatement) || ts.isReturnStatement(singleStatement)) {
                        return ts.factory.updateIfStatement(
                            node,
                            node.expression,
                            singleStatement,
                            node.elseStatement ? visit(node.elseStatement) : undefined
                        );
                    }
                }
            }
            
            // Transform else clauses
            if (ts.isBlock(node) && node.parent && ts.isIfStatement(node.parent) && node.parent.elseStatement === node) {
                if (node.statements.length === 1) {
                    const singleStatement = node.statements[0];
                    if (ts.isExpressionStatement(singleStatement) || ts.isReturnStatement(singleStatement)) {
                        return singleStatement;
                    }
                }
            }
            
            return ts.visitEachChild(node, visit, context);
        };
        
        return (sourceFile) => ts.visitNode(sourceFile, visit);
    };
}

// Post-process the transformed code to ensure single-line formatting
function postProcessCode(code) {
    return code
        // Fix if statements with line breaks
        .replace(/if\s*\((.*?)\)\s*\n\s*(return|[a-zA-Z_][a-zA-Z0-9_]*\s*=)/g, 'if ($1) $2')
        // Fix else statements with line breaks
        .replace(/else\s*\n\s*(return|[a-zA-Z_][a-zA-Z0-9_]*\s*=)/g, 'else $1')
        // Remove extra blank lines
        .replace(/\n\s*\n+/g, '\n\n')
        // Fix any remaining indentation issues
        .replace(/\n\s+(if|else|return)/g, '\n$1');
}

// Code transformation function
function transformCode(sourceCode) {
    const sourceFile = ts.createSourceFile(
        'temp.ts',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
    );
    
    const printer = ts.createPrinter({ 
        newLine: ts.NewLineKind.LineFeed,
        removeComments: false,
        omitTrailingSemicolon: false
    });
    const result = ts.transform(sourceFile, [createTransformer()]);
    const transformedSourceFile = result.transformed[0];
    
    let printed = printer.printFile(transformedSourceFile);
    return postProcessCode(printed);
}

// File processing
function processFile(filePath, dryRun) {
    try {
        const sourceCode = fs.readFileSync(filePath, 'utf-8');
        const transformed = transformCode(sourceCode);
        
        if (sourceCode !== transformed) {
            if (dryRun) {
                console.log(`\nWould transform ${filePath}:`);
                console.log('----------------------------------------');
                console.log(transformed);
                console.log('----------------------------------------');
            } else {
                fs.writeFileSync(filePath, transformed);
                console.log(`✓ Transformed: ${filePath}`);
            }
        } else {
            console.log(`- Skipped (no changes needed): ${filePath}`);
        }
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
    }
}

// Directory scanning
function getAllTypeScriptFiles(dir) {
    let results = [];
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (item === 'node_modules' || item === '.git' || item === 'dist' || item === 'build') {
                continue;
            }
            results = results.concat(getAllTypeScriptFiles(fullPath));
        } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
            results.push(fullPath);
        }
    }
    
    return results;
}

// Main processing function
function processDirectory(dirPath, dryRun) {
    console.log(`\nProcessing directory: ${dirPath}`);
    console.log(`Mode: ${dryRun ? 'Dry Run (no changes will be made)' : 'Live Run'}`);
    
    try {
        const files = getAllTypeScriptFiles(dirPath);
        
        if (files.length === 0) {
            console.log('No TypeScript files found');
            return;
        }
        
        console.log(`Found ${files.length} TypeScript files\n`);
        
        for (const file of files) {
            processFile(file, dryRun);
        }
        
        console.log('\n----------------------------------------');
        console.log(`Completed processing ${files.length} files`);
        if (dryRun) {
            console.log('This was a dry run - no files were modified');
        }
    } catch (error) {
        console.error('Error processing directory:', error);
        process.exit(1);
    }
}

// CLI argument parsing
function parseArgs() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const dirIndex = args.findIndex(arg => !arg.startsWith('--'));
    const dirPath = dirIndex >= 0 ? args[dirIndex] : '.';
    
    return { dirPath, dryRun };
}

// Help text
function printHelp() {
    console.log(`
TypeScript Conditional Statement Transformer

Usage:
  node transform.js [options] [directory]

Options:
  --dry-run    Show what changes would be made without actually making them
  --help       Show this help message

Arguments:
  directory    Directory to process (default: current directory)

Examples:
  node transform.js                    # Process current directory
  node transform.js src               # Process src directory
  node transform.js --dry-run src     # Dry run on src directory
`);
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--help')) {
        printHelp();
        process.exit(0);
    }
    
    const { dirPath, dryRun } = parseArgs();
    
    if (!fs.existsSync(dirPath)) {
        console.error(`Error: Directory '${dirPath}' does not exist`);
        process.exit(1);
    }
    
    processDirectory(dirPath, dryRun);
}
