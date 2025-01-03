import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const REMOVABLE_FUNCTIONS = [
    'countEvent', 
    'countRareEvent', 
    'scopedProfileSectionStart', 
    'scopedProfileSectionEnd', 
    'profileSectionStart', 
    'profileSectionEnd', 
    'playbackLogNote', 
    'debug', 
    'info'
];

function shouldRemoveCall(node) {
    if (!ts.isCallExpression(node)) return false;
    const expression = node.expression;
    
    if (ts.isPropertyAccessExpression(expression)) {
        const methodName = expression.name.getText();
        if (expression.expression.getText() === 'console' && methodName === 'log') {
            return true;
        }
        if (REMOVABLE_FUNCTIONS.includes(methodName)) {
            return true;
        }
    }
    return false;
}

function processNode(context) {
    function visit(node) {
        if (!node) return node;

        if (ts.isIfStatement(node)) {
            let thenStatement = ts.visitNode(node.thenStatement, visit);
            let elseStatement = node.elseStatement ? ts.visitNode(node.elseStatement, visit) : undefined;

            // If then branch is just a removable call
            if (ts.isExpressionStatement(node.thenStatement) && 
                shouldRemoveCall(node.thenStatement.expression)) {
                return elseStatement;
            }

            // If else branch is just a removable call
            if (elseStatement && ts.isExpressionStatement(node.elseStatement) && 
                shouldRemoveCall(node.elseStatement.expression)) {
                elseStatement = undefined;
            }

            if (!thenStatement) {
                return elseStatement;
            }

            if (thenStatement !== node.thenStatement || elseStatement !== node.elseStatement) {
                return ts.factory.updateIfStatement(
                    node,
                    node.expression,
                    thenStatement,
                    elseStatement
                );
            }
            return node;
        }

        if (ts.isExpressionStatement(node) && shouldRemoveCall(node.expression)) {
            return undefined;
        }

        return ts.visitEachChild(node, visit, context);
    }

    return visit;
}

function removeCommentsAndEmptyLines(sourceFile) {
    // Create a custom transformer to preserve eslint comments
    const transformer = (context) => (rootNode) => {
        function visitNode(node) {
            // Save eslint comments
            const leadingComments = ts.getLeadingCommentRanges(sourceFile.text, node.pos);
            const trailingComments = ts.getTrailingCommentRanges(sourceFile.text, node.end);
            
            const eslintComments = [];
            if (leadingComments) {
                leadingComments.forEach(comment => {
                    const commentText = sourceFile.text.slice(comment.pos, comment.end);
                    if (commentText.includes('eslint')) {
                        eslintComments.push(commentText);
                    }
                });
            }
            
            if (trailingComments) {
                trailingComments.forEach(comment => {
                    const commentText = sourceFile.text.slice(comment.pos, comment.end);
                    if (commentText.includes('eslint')) {
                        eslintComments.push(commentText);
                    }
                });
            }
            
            return ts.visitEachChild(node, visitNode, context);
        }
        
        return ts.visitNode(rootNode, visitNode);
    };

    // Transform to preserve eslint comments
    const result = ts.transform(sourceFile, [transformer]);
    
    // Print with all comments initially
    const printer = ts.createPrinter({ 
        removeComments: false,
        newLine: ts.NewLineKind.LineFeed
    });
    
    const printed = printer.printFile(result.transformed[0]);
    
    // Filter empty lines but preserve eslint comments
    return printed
        .split('\n')
        .filter(line => line.includes('eslint') || line.trim().length > 0)
        .join('\n');
}

function processFile(filePath) {
    try {
        const sourceText = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(
            filePath,
            sourceText,
            ts.ScriptTarget.Latest,
            true
        );

        const result = ts.transform(sourceFile, [
            (context) => (node) => ts.visitNode(node, processNode(context))
        ]);

        const transformedCode = removeCommentsAndEmptyLines(result.transformed[0]);
        fs.writeFileSync(filePath, transformedCode);
        console.log(`Processed: ${filePath}`);
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
    }
}

function processDirectory(directoryPath) {
    const files = fs.readdirSync(directoryPath);
    
    files.forEach(file => {
        const filePath = path.join(directoryPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
            processDirectory(filePath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            processFile(filePath);
        }
    });
}

const projectDirectory = process.argv[2] || '.';
if (!fs.existsSync(projectDirectory)) {
    console.error('Directory does not exist:', projectDirectory);
    process.exit(1);
}

processDirectory(projectDirectory);
