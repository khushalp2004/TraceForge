const fs = require('fs');
let code = fs.readFileSync('page.tsx', 'utf-8');
code = code.replace('if (!isSuperAdmin) {', 'if (false) { /*');
code = code.replace(') : null}\n      </div>\n    );\n  }', ') : null}\n      </div>\n    );\n  } */');
fs.writeFileSync('page.tsx', code);
