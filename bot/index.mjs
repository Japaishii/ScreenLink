import {readFile} from 'node:fs/promises';
import {Client,Events,GatewayIntentBits,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,PermissionFlagsBits} from 'discord.js';
import {parseRooms,shouldAnnounce} from './config.mjs';

if(!process.env.DISCORD_BOT_TOKEN||!process.env.SCREENLINK_URL)throw new Error('Configure DISCORD_BOT_TOKEN e SCREENLINK_URL no ambiente do bot.');
const bindings=parseRooms(JSON.parse(await readFile(process.env.ROOMS_FILE||'rooms.json','utf8')),process.env.SCREENLINK_URL);
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildVoiceStates]});
const lastSent=new Map();const sending=new Set();
client.once(Events.ClientReady,async ready=>{
 console.log(`Screenlink Bot conectado como ${ready.user.tag}. ${bindings.length} vínculo(s) configurado(s).`);
 for(const binding of bindings){try{const channel=await client.channels.fetch(binding.textChannelId);const guild=client.guilds.cache.get(binding.guildId);const voice=await guild?.channels.fetch(binding.voiceChannelId);const permissions=channel?.permissionsFor?.(ready.user);if(!voice?.isVoiceBased()||channel?.guildId!==binding.guildId||!channel.isSendable()||!permissions?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks]))console.error(`Verifique canais/permissões do vínculo ${binding.voiceChannelId}.`);}catch{console.error(`Não foi possível verificar o vínculo ${binding.voiceChannelId}.`);}}
});
client.on(Events.VoiceStateUpdate,async(oldState,newState)=>{
 if(!shouldAnnounce(oldState,newState))return;
 const binding=bindings.find(b=>b.guildId===newState.guild.id&&b.voiceChannelId===newState.channelId);if(!binding)return;
 const key=`${binding.guildId}:${binding.voiceChannelId}`;if(sending.has(key)||Date.now()-(lastSent.get(key)||0)<30000)return;sending.add(key);
 try{
  const channel=await client.channels.fetch(binding.textChannelId);if(!channel?.isSendable()||channel.guildId!==binding.guildId)throw new Error('Canal de texto inválido.');
  const embed=new EmbedBuilder().setColor(0xb7f38b).setTitle('A call começou. Bora compartilhar?').setDescription(`Alguém entrou em <#${binding.voiceChannelId}>.\nAbra a sala no Screenlink para conversar, usar a câmera e transmitir sua tela.`).addFields({name:'Sala de transmissão',value:`[Abrir Screenlink](${binding.url})`}).setFooter({text:'Câmera e microfone são ativados por você no navegador. Salas privadas continuam exigindo senha.'});
  const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Abrir sala e transmitir').setURL(binding.url));
  await channel.send({embeds:[embed],components:[row],allowedMentions:{parse:[]}});lastSent.set(key,Date.now());
 }catch{console.error(`Falha ao publicar convite no canal ${binding.textChannelId}. Confira as permissões e a configuração.`);}finally{sending.delete(key);}
});
client.on(Events.Error,()=>console.error('Erro na conexão com o Discord; confira a rede e a configuração.'));
client.on(Events.Warn,()=>console.warn('Aviso do Gateway Discord; verifique a conexão do bot.'));
process.once('SIGTERM',()=>{client.destroy();process.exit(0);});process.once('SIGINT',()=>{client.destroy();process.exit(0);});
await client.login(process.env.DISCORD_BOT_TOKEN).catch(()=>{console.error('Não foi possível autenticar o bot. Confira DISCORD_BOT_TOKEN e os intents.');process.exit(1);});
