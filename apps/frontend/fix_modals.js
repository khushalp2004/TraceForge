const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('/Users/khushalpatil/Desktop/usetraceforge.com/apps/frontend/app/dashboard');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Replace modal backdrop
    content = content.replace(/className="fixed inset-0[^"]*flex items-center justify-center[^"]*"/g, 'className="tf-modal-backdrop"');
    content = content.replace(/className="fixed inset-0[^"]*overflow-y-auto[^"]*"/g, 'className="tf-modal-backdrop"');
    
    // Replace modal panel
    content = content.replace(/className="w-full max-w-[a-z]+[^"]*bg-card[^"]*"/g, 'className="tf-modal-panel"');
    content = content.replace(/className="relative w-full max-w-[a-z]+[^"]*bg-card[^"]*"/g, 'className="tf-modal-panel"');
    content = content.replace(/className="w-full max-w-[a-z]+[^"]*bg-background[^"]*"/g, 'className="tf-modal-panel"');
    content = content.replace(/className="relative w-full max-w-[a-z]+[^"]*bg-background[^"]*"/g, 'className="tf-modal-panel"');

    // Account Details page has some modals with slightly different background
    content = content.replace(/className="w-full max-w-2xl[^"]*bg-card[^"]*"/g, 'className="tf-modal-panel max-w-2xl"');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed modals in: ' + file);
    }
});
