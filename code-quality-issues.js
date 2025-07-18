// CODE QUALITY ISSUES - Intentional quality problems for testing

// 1. Long function with multiple responsibilities
function processUserData(user) {
    // Validate user data
    if (!user || !user.name || !user.email) {
        throw new Error('Invalid user data');
    }
    
    // Format user data
    const formattedUser = {
        name: user.name.toUpperCase(),
        email: user.email.toLowerCase(),
        id: user.id || generateId()
    };
    
    // Save to database
    const savedUser = db.users.save(formattedUser);
    
    // Send welcome email
    emailService.sendWelcomeEmail(savedUser.email);
    
    // Update analytics
    analytics.trackUserRegistration(savedUser);
    
    // Return result
    return savedUser;
}

// 2. Deep nesting
function processOrder(order) {
    if (order) {
        if (order.items) {
            if (order.items.length > 0) {
                for (const item of order.items) {
                    if (item.price) {
                        if (item.price > 0) {
                            if (item.quantity) {
                                if (item.quantity > 0) {
                                    processItem(item);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// 3. Magic numbers
function calculateDiscount(price) {
    if (price > 100) {
        return price * 0.1; // Magic number 0.1
    } else if (price > 50) {
        return price * 0.05; // Magic number 0.05
    } else {
        return price * 0.02; // Magic number 0.02
    }
}

// 4. Inconsistent naming
function getUserData(userId) {
    const user_data = fetchUser(userId);
    const userData = formatUserData(user_data);
    return userData;
}

// 5. Commented out code
function processPayment(payment) {
    // const result = oldPaymentProcessor.process(payment);
    const result = newPaymentProcessor.process(payment);
    return result;
}

// 6. Duplicate code
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validateUserEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// 7. Unused variables
function processData(data) {
    const processedData = data.map(item => item * 2);
    const unusedVariable = 'this is never used';
    return processedData;
}

// 8. Inconsistent formatting
function formatData(data){
    if(data){
        const result=data.map(item=>{
            return item.name;
        });
        return result;
    }
    return [];
}

// 9. Overly complex expressions
function isValidUser(user) {
    return user && user.name && user.email && user.age && user.age >= 18 && user.age <= 65 && user.email.includes('@') && user.email.includes('.') && user.name.length > 0;
}

// 10. Inconsistent return types
function getValue(key) {
    if (key === 'count') {
        return 42;
    } else if (key === 'name') {
        return 'John';
    } else if (key === 'active') {
        return true;
    } else {
        return null;
    }
}

// 11. Poor error handling
function riskyOperation() {
    try {
        return dangerousFunction();
    } catch (e) {
        console.log('Error occurred');
    }
}

// 12. Inconsistent indentation
function badFormatting() {
const x = 1;
  const y = 2;
    const z = 3;
  return x + y + z;
}

// 13. Overly long lines
function longLine() {
    const veryLongVariableName = someVeryLongFunctionCall(withManyParameters, thatMakesThisLineExceedTheRecommendedLength, andShouldBeBrokenIntoMultipleLines, forBetterReadability);
}

// 14. Inconsistent use of semicolons
function inconsistentSemicolons() {
    const a = 1
    const b = 2;
    const c = 3
    return a + b + c;
}

// 15. Poor variable naming
function processData(d) {
    const x = d.map(i => i.v);
    const y = x.filter(z => z > 0);
    return y;
} 