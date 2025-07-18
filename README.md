# Test Repository for AI Code Analyzer

This repository contains intentional issues and vulnerabilities to test the AI code analyzer's detection capabilities.

## Files with Intentional Issues

### 🔒 Security Issues (`security-issues.js`)
- SQL Injection vulnerabilities
- XSS vulnerabilities
- Hardcoded credentials and secrets
- Insecure random number generation
- Directory traversal vulnerabilities
- No input validation
- Weak password hashing
- CORS misconfiguration
- Sensitive data in logs
- Insecure cookie settings

### 🐛 Logic Issues (`logic-issues.js`)
- Infinite loop potential
- Off-by-one errors
- Race conditions
- Memory leaks
- Dead code
- Incorrect boolean logic
- Null pointer dereference
- Incorrect string comparison
- Division by zero potential
- Incorrect date handling
- Unreachable code
- Incorrect async handling
- Incorrect object property access
- Incorrect array manipulation
- Incorrect type checking

### 📝 Console Issues (`console-issues.js`)
- Console.log in production code
- Console.error without proper error handling
- Console.warn for debugging
- Console.info for development
- Console.debug statements
- Console.trace for debugging
- Console.group for debugging
- Console.table for debugging
- Console.time for performance debugging
- Console.count for debugging
- Console.assert for debugging
- Console.dir for object inspection
- Console.clear for debugging
- Multiple console statements
- Console with sensitive data

### ⚡ Performance Issues (`performance-issues.js`)
- N+1 query problems
- Inefficient array operations (O(n²))
- Memory leaks with event listeners
- Synchronous operations in async context
- Inefficient string concatenation
- Unnecessary DOM queries
- Inefficient object property access
- Blocking operations
- Inefficient regex usage
- Unnecessary API calls
- Inefficient caching
- Synchronous file operations
- Inefficient sorting
- Memory-intensive operations
- Inefficient database queries

### 🎯 Code Quality Issues (`code-quality-issues.js`)
- Long functions with multiple responsibilities
- Deep nesting
- Magic numbers
- Inconsistent naming
- Commented out code
- Duplicate code
- Unused variables
- Inconsistent formatting
- Overly complex expressions
- Inconsistent return types
- Poor error handling
- Inconsistent indentation
- Overly long lines
- Inconsistent use of semicolons
- Poor variable naming

### ♿ Accessibility Issues (`accessibility-issues.html`)
- Missing alt text for images
- Missing form labels
- Poor color contrast
- Missing heading structure
- Non-semantic HTML
- Missing ARIA labels
- Poor focus indicators
- Missing skip links
- Inaccessible tables
- Poor form validation
- Missing language attributes
- Inaccessible custom controls
- Poor keyboard navigation
- Missing landmarks
- Inaccessible multimedia
- Poor text alternatives
- Inaccessible dynamic content
- Poor link text
- Missing form fieldset
- Inaccessible CAPTCHA

## Usage

These files are intentionally created with issues to test the AI analyzer's ability to:

1. **Detect Security Vulnerabilities**: SQL injection, XSS, hardcoded secrets, etc.
2. **Identify Logic Bugs**: Infinite loops, null pointer dereferences, etc.
3. **Find Debugging Code**: Console statements, commented code, etc.
4. **Spot Performance Issues**: N+1 queries, memory leaks, etc.
5. **Assess Code Quality**: Long functions, magic numbers, etc.
6. **Check Accessibility**: Missing alt text, poor contrast, etc.

## Testing the AI Analyzer

When running the AI analyzer on this repository, it should be able to:

- **Categorize Issues**: Properly classify issues by type (security, performance, etc.)
- **Provide Severity Levels**: Identify critical vs. minor issues
- **Suggest Fixes**: Offer specific recommendations for each issue
- **Explain Problems**: Provide clear explanations of why each issue is problematic

## Note

⚠️ **WARNING**: These files contain intentional vulnerabilities and should NEVER be used in production code. They are strictly for testing purposes only.