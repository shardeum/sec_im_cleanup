

**clean1.js:**

1. This script is focused on removing specific types of code:

   - Removes calls to specific logging/profiling functions like `countEvent`, `countRareEvent`, `debug`, `info`, etc.

   - Removes `console.log` statements

   - Removes empty lines and comments (while preserving ESLint comments)

2. If these calls are inside `if` statements, it will clean up the conditional structure by removing the empty branches

Think of it as a "code cleaner" that removes debugging and profiling code from a production codebase.

**clean2.js:**

1. This script focuses on simplifying conditional statements by removing unnecessary block syntax

2. For example, it would transform:

```typescript

if (condition) {

    doSomething();

}

```

into:

```typescript

if (condition) doSomething();

```
