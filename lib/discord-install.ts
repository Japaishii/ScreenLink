export function discordInstallUrl(clientId:string){
 if(!/^\d{17,22}$/.test(clientId.trim()))return null;
 const url=new URL('https://discord.com/oauth2/authorize');
 url.searchParams.set('client_id',clientId.trim());
 url.searchParams.set('scope','bot');
 // View Channels + Send Messages + Embed Links. Sem Administrator.
 url.searchParams.set('permissions','19456');
 return url.toString();
}
