'use client';
import {useEffect,useRef,useState} from 'react';
import {RoomConnection} from './room-connection';
export type MediaKind='screen'|'camera'|'microphone';
export type Participant={id:string;name:string;sharing:boolean;camera:boolean;microphone:boolean};
export type ChatMessage={id:number;userId:string;name:string;text:string;created:number;clientId:string};
export type Feed={id:string;peer:string;kind:MediaKind;stream:MediaStream;local:boolean};
const kinds:MediaKind[]=['screen','camera','microphone'];
export function useRoomMedia(roomId:string){
 const [participants,setParticipants]=useState<Participant[]>([]),[feeds,setFeeds]=useState<Feed[]>([]),[messages,setMessages]=useState<ChatMessage[]>([]),[connected,setConnected]=useState(false),[error,setError]=useState(''),[self,setSelf]=useState(''),[pending,setPending]=useState<MediaKind|null>(null);
 const connection=useRef<RoomConnection|null>(null),local=useRef(new Map<MediaKind,MediaStream>()),pcs=useRef(new Map<string,RTCPeerConnection>()),publish=useRef<()=>void>(()=>{}),alive=useRef(false),acquiring=useRef(false),generation=useRef(0);
 function stop(kind:MediaKind){const stream=local.current.get(kind);local.current.delete(kind);stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});for(const [key,pc]of pcs.current)if(key.startsWith(`out:${kind}:`)){pc.close();pcs.current.delete(key);}setFeeds(prev=>prev.filter(f=>!(f.local&&f.kind===kind)));publish.current();}
 useEffect(()=>{
  alive.current=true;generation.current++;let disposed=false;const session=new RoomConnection(roomId);connection.current=session;const ice:{servers:RTCIceServer[]}={servers:[]};const candidates=new Map<string,RTCIceCandidateInit[]>();const chains=new Map<string,Promise<void>>();
  const flag=(kind:MediaKind)=>kind==='screen'?'sharing':kind;
  publish.current=()=>{for(const kind of kinds)session.emit(flag(kind),local.current.has(kind));};
  function make(peer:string,kind:MediaKind,out:boolean){const key=`${out?'out':'in'}:${kind}:${peer}`;pcs.current.get(key)?.close();const pc=new RTCPeerConnection({iceServers:ice.servers});pcs.current.set(key,pc);
   pc.onicecandidate=e=>{if(e.candidate)session.emit('signal',{to:peer,signal:{type:'candidate',kind,outgoing:out,candidate:e.candidate.toJSON()}});};
   pc.ontrack=e=>{if(disposed)return;const stream=e.streams[0]||new MediaStream([e.track]);const id=`${peer}:${kind}`;setFeeds(prev=>[...prev.filter(f=>f.id!==id),{id,peer,kind,stream,local:false}]);};
   pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'&&!disposed){pc.close();pcs.current.delete(key);setError('Uma conexão de mídia falhou. Tente reconectar à sala e confira o serviço TURN.');}};
   return pc;
  }
  async function offer(peer:string,kind:MediaKind,stream:MediaStream){const key=`out:${kind}:${peer}`;if(pcs.current.has(key))return;const pc=make(peer,kind,true);stream.getTracks().forEach(t=>pc.addTrack(t,stream));await pc.setLocalDescription(await pc.createOffer());if(!disposed&&pcs.current.get(key)===pc)session.emit('signal',{to:peer,signal:{type:'offer',kind,description:pc.localDescription}});}
  session.on('connect',()=>{setSelf(session.id);setConnected(true);setError('');publish.current();});
  session.on('connect_error',(e:Error)=>{if(!disposed)setError(e.message);});
  session.on('disconnect',()=>{if(disposed)return;setConnected(false);setParticipants([]);setFeeds(prev=>prev.filter(f=>f.local));for(const pc of pcs.current.values())pc.close();pcs.current.clear();candidates.clear();});
  session.on('participants',(list:Participant[])=>{if(disposed)return;setParticipants(list);for(const person of list){if(person.id===session.id)continue;for(const [kind,stream]of local.current)offer(person.id,kind,stream).catch(()=>{if(!disposed)setError('Não foi possível iniciar uma transmissão.');});for(const kind of kinds)if(!person[flag(kind)]){const key=`in:${kind}:${person.id}`;pcs.current.get(key)?.close();pcs.current.delete(key);candidates.delete(key);setFeeds(prev=>prev.filter(f=>!(f.peer===person.id&&f.kind===kind&&!f.local)));}}});
  session.on('peer-left',(id:string)=>{for(const kind of kinds)for(const direction of ['in','out']){const key=`${direction}:${kind}:${id}`;pcs.current.get(key)?.close();pcs.current.delete(key);candidates.delete(key);}setFeeds(prev=>prev.filter(f=>f.peer!==id));});
  session.on('chat',(items:ChatMessage[])=>{if(!disposed)setMessages(prev=>Array.from(new Map([...prev,...items].map(m=>[m.id,m])).values()).sort((a,b)=>a.id-b.id).slice(-300));});
  session.on('signal',({from,signal})=>{
   const kind:MediaKind=signal.kind||'screen';if(!kinds.includes(kind))return;const key=`${signal.type==='answer'||(signal.type==='candidate'&&!signal.outgoing)?'out':'in'}:${kind}:${from}`;
   // Processa SDP e candidatos do mesmo fluxo em ordem, inclusive durante awaits.
   const next=(chains.get(key)||Promise.resolve()).then(async()=>{if(disposed)return;
    if(signal.type==='offer'){const pc=make(from,kind,false);await pc.setRemoteDescription(signal.description);for(const c of candidates.get(key)||[])await pc.addIceCandidate(c);candidates.delete(key);await pc.setLocalDescription(await pc.createAnswer());session.emit('signal',{to:from,signal:{type:'answer',kind,description:pc.localDescription}});}
    else if(signal.type==='answer'){const pc=pcs.current.get(key);if(pc&&pc.signalingState==='have-local-offer'){await pc.setRemoteDescription(signal.description);for(const c of candidates.get(key)||[])await pc.addIceCandidate(c);candidates.delete(key);}}
    else if(signal.type==='candidate'){const pc=pcs.current.get(key);if(pc?.remoteDescription)await pc.addIceCandidate(signal.candidate);else candidates.set(key,[...(candidates.get(key)||[]),signal.candidate]);}
   }).catch(()=>{if(!disposed)setError('Falha ao negociar mídia com um participante. Reconecte à sala.');});chains.set(key,next);
  });
  fetch('/api/ice').then(async r=>{if(!r.ok)throw new Error('Não foi possível configurar a mídia.');return r.json();}).then(d=>{if(!disposed){ice.servers=d.iceServers;session.connect();}}).catch(e=>{if(!disposed)setError(e.message);});
  return()=>{disposed=true;alive.current=false;generation.current++;session.disconnect();connection.current=null;for(const stream of local.current.values())stream.getTracks().forEach(t=>{t.onended=null;t.stop();});local.current.clear();for(const pc of pcs.current.values())pc.close();pcs.current.clear();};
 },[roomId]);
 async function toggle(kind:MediaKind){if(local.current.has(kind)){stop(kind);return;}if(acquiring.current)return;acquiring.current=true;setPending(kind);setError('');const current=generation.current;
  try{if(!navigator.mediaDevices)throw new Error('Câmera e microfone precisam de HTTPS e um navegador compatível.');const stream=kind==='screen'?await navigator.mediaDevices.getDisplayMedia({video:true,audio:true}):await navigator.mediaDevices.getUserMedia(kind==='camera'?{video:{width:{ideal:1280},height:{ideal:720}},audio:false}:{audio:{echoCancellation:true,noiseSuppression:true},video:false});if(!alive.current||current!==generation.current){stream.getTracks().forEach(t=>t.stop());return;}local.current.set(kind,stream);(kind==='screen'?stream.getVideoTracks():stream.getTracks()).forEach(t=>t.onended=()=>stop(kind));setFeeds(prev=>[...prev.filter(f=>!(f.local&&f.kind===kind)),{id:`self:${kind}`,peer:'self',kind,stream,local:true}]);publish.current();
  }catch(e){if(alive.current){const name=(e as Error).name;setError(name==='NotAllowedError'?'Permissão recusada. Autorize o dispositivo no navegador para participar.':name==='NotFoundError'?'Dispositivo não encontrado. Confira sua câmera ou microfone.':(e as Error).message);}}
  finally{acquiring.current=false;if(alive.current)setPending(null);}
 }
 return {participants,feeds,messages,connected,self,error,setError,pending,toggle,sendMessage:(text:string,clientId:string)=>connection.current?.sendMessage(text,clientId)??Promise.reject(new Error('Entre na sala para conversar.'))};
}
