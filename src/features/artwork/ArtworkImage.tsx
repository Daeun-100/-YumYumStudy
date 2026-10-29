import { useContext, useState } from 'react';
import { Image, type ImageProps, type ImageSourcePropType } from 'react-native';
import { ArtworkContext } from './ArtworkContext';
type Props=ImageProps & {fallbackSource:ImageSourcePropType};
function ImageWithFallback({fallbackSource,onError,...props}:Props){
 const store=useContext(ArtworkContext);
 const [failed,setFailed]=useState(false);
 return <Image {...props} source={failed?fallbackSource:props.source} onError={event=>{
  if(failed)return;setFailed(true);
  const source=props.source;
  if(source&&!Array.isArray(source)&&typeof source==='object'&&'uri' in source&&source.uri&&store){
   for(const entry of store.read().values())if(entry.manifest){const m=entry.manifest;try{if([m.home,m.focus].some(a=>store.url(a)===source.uri))store.invalidate(m);}catch{/* A malformed entry is never used. */}}
  }
  onError?.(event);
 }} />;
}
export function ArtworkImage(props:Props){
 const source=props.source;
 const key=source&&!Array.isArray(source)&&typeof source==='object'&&'uri' in source?source.uri:String(source);
 return <ImageWithFallback key={key} {...props}/>;
}
