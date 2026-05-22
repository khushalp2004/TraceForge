const fs = require('fs');
const content = fs.readFileSync('page.tsx', 'utf-8').split('\n');
let stack = [];
let inString = false;
let stringChar = '';
for(let i=0; i<664; i++) {
  let line = content[i];
  for(let j=0; j<line.length; j++) {
    let c = line[j];
    if (inString) {
      if (c === stringChar && line[j-1] !== '\\') inString = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inString = true;
      stringChar = c;
      continue;
    }
    if (c === '{') stack.push({line: i+1});
    if (c === '}') stack.pop();
  }
}
console.log(stack);
