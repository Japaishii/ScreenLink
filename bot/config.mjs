export function parseRooms(raw,site){
 const origin=new URL(site);if(origin.protocol!=='https:')throw new Error('SCREENLINK_URL deve usar HTTPS.');
 if(!Array.isArray(raw)||!raw.length)throw new Error('Configure pelo menos um vínculo em rooms.json.');
 const seen=new Set();return raw.map(item=>{
  for(const key of ['guildId','voiceChannelId','textChannelId'])if(!/^\d{17,22}$/.test(item[key]||''))throw new Error(`ID inválido: ${key}`);
  if(!/^[a-f0-9]{24}$/.test(item.roomId||''))throw new Error('roomId deve ser o identificador do convite Screenlink.');
  const key=`${item.guildId}:${item.voiceChannelId}`;if(seen.has(key))throw new Error('Canal de voz duplicado.');seen.add(key);
  const url=new URL('/',origin.origin);url.searchParams.set('room',item.roomId);return {...item,url:url.toString()};
 });
}
export function shouldAnnounce(oldState,newState){return !!newState.channelId&&oldState.channelId!==newState.channelId&&!newState.member?.user.bot;}
