// PERFORMANCE ISSUES - Intentional performance problems for testing

// 1. N+1 query problem
async function getUsersWithPosts() {
    const users = await db.users.findAll();
    for (const user of users) {
        user.posts = await db.posts.findAll({ where: { userId: user.id } }); // N+1 problem
    }
    return users;
}

// 2. Inefficient array operations
function findDuplicates(arr) {
    const duplicates = [];
    for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
            if (arr[i] === arr[j]) {
                duplicates.push(arr[i]);
            }
        }
    }
    return duplicates; // O(n²) instead of O(n)
}

// 3. Memory leak with event listeners
function addEventListeners() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('Button clicked');
        }); // No cleanup
    });
}

// 4. Synchronous operations in async context
async function processData() {
    const data = await fetch('/api/data');
    const result = heavySynchronousOperation(data); // Blocks event loop
    return result;
}

// 5. Inefficient string concatenation
function buildLargeString(items) {
    let result = '';
    for (const item of items) {
        result += item.name + ', '; // Inefficient string concatenation
    }
    return result;
}

// 6. Unnecessary DOM queries
function updateElements() {
    const element1 = document.getElementById('element1');
    const element2 = document.getElementById('element2');
    const element3 = document.getElementById('element3');
    // ... many more queries
    element1.textContent = 'Updated';
    element2.textContent = 'Updated';
    element3.textContent = 'Updated';
}

// 7. Inefficient object property access
function processObject(obj) {
    for (let i = 0; i < 1000; i++) {
        const value = obj['property' + i]; // Dynamic property access
        console.log(value);
    }
}

// 8. Blocking operations
function processLargeArray(arr) {
    const result = [];
    for (const item of arr) {
        const processed = heavyProcessing(item); // Blocks main thread
        result.push(processed);
    }
    return result;
}

// 9. Inefficient regex usage
function validateEmails(emails) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emails.filter(email => emailRegex.test(email)); // Regex recompiled each time
}

// 10. Unnecessary API calls
function getUserData(userId) {
    fetch(`/api/users/${userId}/profile`);
    fetch(`/api/users/${userId}/settings`);
    fetch(`/api/users/${userId}/preferences`);
    // Should be batched into one call
}

// 11. Inefficient caching
function getCachedData(key) {
    if (cache[key]) {
        return cache[key];
    }
    const data = fetchData(key);
    cache[key] = data; // No cache size limit
    return data;
}

// 12. Synchronous file operations
function readMultipleFiles(files) {
    const contents = [];
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8'); // Synchronous I/O
        contents.push(content);
    }
    return contents;
}

// 13. Inefficient sorting
function sortLargeArray(arr) {
    return arr.sort((a, b) => {
        // Complex comparison function called multiple times
        return a.name.localeCompare(b.name) + a.age - b.age;
    });
}

// 14. Memory-intensive operations
function createLargeObjects(count) {
    const objects = [];
    for (let i = 0; i < count; i++) {
        objects.push({
            id: i,
            data: 'x'.repeat(10000), // Large strings
            metadata: { /* large object */ }
        });
    }
    return objects;
}

// 15. Inefficient database queries
function getUserStats(userId) {
    const posts = db.query('SELECT * FROM posts WHERE user_id = ?', [userId]);
    const comments = db.query('SELECT * FROM comments WHERE user_id = ?', [userId]);
    const likes = db.query('SELECT * FROM likes WHERE user_id = ?', [userId]);
    // Should use JOINs instead of multiple queries
} 