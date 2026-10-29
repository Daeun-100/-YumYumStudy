import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
const crcTable=Array.from({length:256},(_,index)=>{let n=index;for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
/** Decode bounded PNG rows to reject damaged files and opaque character cutouts. */
export function inspectPng(bytes,{kind,screen}){
 if(!Buffer.isBuffer(bytes)||bytes.length>5242880||bytes.length<45||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('PNG up to 5 MiB required.');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),depth=bytes[24],color=bytes[25];
 const expected=screen==='home'?[1536,1024]:kind==='skin'?[1254,1254]:[1024,1536];
 if(width!==expected[0]||height!==expected[1]||depth!==8||![2,6].includes(color)||bytes[26]!==0||bytes[27]!==0||bytes[28]!==0)throw Error(`Expected non-interlaced 8-bit ${expected.join('x')} RGB/RGBA PNG.`);
 if(kind==='skin'&&color!==6)throw Error('Skin PNG needs transparent RGBA.');
 let at=8,ended=false;const idat=[];
 while(at<bytes.length){
  if(at+12>bytes.length)throw Error('Truncated PNG chunk.');
  const length=bytes.readUInt32BE(at),end=at+12+length;
  if(end>bytes.length)throw Error('Truncated PNG data.');
  const type=bytes.toString('ascii',at+4,at+8);
  if(crc(bytes.subarray(at+4,end-4))!==bytes.readUInt32BE(end-4))throw Error('PNG checksum failed.');
  if(at===8&&(type!=='IHDR'||length!==13))throw Error('PNG header required.');
  if(type==='IHDR'&&at!==8)throw Error('Duplicate PNG header.');
  if(/^[A-Z]/.test(type)&&!['IHDR','PLTE','IDAT','IEND'].includes(type))throw Error('Unsupported critical PNG chunk.');
  if(type==='IDAT')idat.push(bytes.subarray(at+8,end-4));
  if(type==='IEND'){if(length||end!==bytes.length)throw Error('Invalid PNG end.');ended=true;}
  at=end;
 }
 if(!ended||!idat.length)throw Error('Incomplete PNG.');
 const channels=color===6?4:3,stride=width*channels,raw=inflateSync(Buffer.concat(idat),{maxOutputLength:(stride+1)*height});
 if(raw.length!==(stride+1)*height)throw Error('Invalid PNG decoded size.');
 let previous=Buffer.alloc(stride),transparent=false;
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)],row=Buffer.from(raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)));
  if(filter>4)throw Error('Invalid PNG filter.');
  for(let x=0;x<stride;x++){
   const a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0;
   row[x]=(row[x]+(filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;
   if(color===6&&x%4===3&&row[x]<255)transparent=true;
  }
  previous=row;
 }
 if(kind==='skin'&&!transparent)throw Error('Skin PNG has no transparent pixels.');
 return {bytes:bytes.length,width,height,sha256:createHash('sha256').update(bytes).digest('hex')};
}
