const fs = require('fs');
const path = require('path');

const dir = '/Users/mac/hotel_pms/apps/web/src/app/(inventory)/inventory';

function walkSync(currentDirPath, callback) {
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
        var stat = fs.statSync(filePath);
        if (stat.isFile() && filePath.endsWith('.tsx')) {
            callback(filePath, stat);
        } else if (stat.isDirectory()) {
            walkSync(filePath, callback);
        }
    });
}

walkSync(dir, function(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Light theme replacements
    content = content.replace(/border-slate-800/g, 'border-slate-200');
    content = content.replace(/bg-slate-950\/50/g, 'bg-slate-50');
    content = content.replace(/bg-slate-950/g, 'bg-white');
    content = content.replace(/hover:bg-slate-800\/50/g, 'hover:bg-slate-100');
    content = content.replace(/divide-slate-800/g, 'divide-slate-200');
    content = content.replace(/border-slate-700/g, 'border-slate-200');
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated:', filePath);
    }
});
