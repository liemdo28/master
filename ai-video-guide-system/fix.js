const fs=require('fs')  
const f='d:/Project/Master/ai-video-guide-system/wm.js'  
const lines=fs.readFileSync(f,'utf8').split('\n')  
lines.pop()  
fs.writeFileSync(f,lines.join('\n'))  
console.log('lines:',lines.length)  
