# Screenlink para Windows

O desktop abre na lista de servidores públicos. Use a busca por nome ou descrição e a seção **Em chamada** para encontrar salas com pessoas conectadas. Salas privadas entram pelo link ou código de convite e pedem a senha da sala.

O cliente usa Windows Forms com o WebView2 Evergreen e reutiliza o chat e a chamada WebRTC do Screenlink. O pacote x64 inclui o runtime .NET. O Windows precisa ter o [WebView2 Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/#download-section).

## Rodar no seu PC

1. Na raiz do projeto, execute `npm ci` e `npm run dev`.
2. Abra `desktop/dist/Screenlink/Screenlink.exe` se o pacote já foi gerado. Para recompilar, instale o SDK .NET 10 e execute no PowerShell:

   ```powershell
   dotnet publish desktop/Screenlink.csproj -c Release -r win-x64 --self-contained -o desktop/dist/Screenlink
   .\desktop\dist\Screenlink\Screenlink.exe
   ```

3. O aplicativo abre `http://localhost:3000/desktop` por padrão. Para criar uma sala pública, abra `http://localhost:3000/app`, entre e use **Criar servidor**.

## Enviar para os amigos

1. Publique este código num ambiente HTTPS com um banco compartilhado. O [guia da Vercel](VERCEL.md) cobre o deploy com Turso e as variáveis de TURN para chamadas entre redes diferentes. Crie uma sala de teste no site publicado.
2. Gere o pacote como na seção anterior. Coloque a origem publicada em `servidor.txt`, ao lado do executável, e compacte a pasta inteira:

   ```powershell
   Set-Content -LiteralPath 'desktop/dist/Screenlink/servidor.txt' -Encoding ascii -Value 'https://SEU-DOMINIO'
   Compress-Archive -Path 'desktop/dist/Screenlink/*' -DestinationPath 'desktop/dist/Screenlink-Windows-x64.zip' -Force
   ```

3. Envie o ZIP e o link da sala. Cada amigo deve extrair o ZIP e abrir `Screenlink.exe` no Windows x64. Este pacote de teste é portátil e sem assinatura digital. O SmartScreen pode exibir um aviso.
4. Peça a duas pessoas em redes diferentes para entrar como convidado, abrir a mesma sala e clicar em **Entrar na chamada**. Cada pessoa deve testar o microfone, a câmera, o chat e o compartilhamento de uma janela. Testem também a busca e o filtro de salas em chamada e a entrada por convite em uma sala privada.
5. Para oferecer o ZIP na landing page, hospede-o num endereço de download e configure `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` antes de reconstruir o site.

## Comparar uso de RAM

Use o Gerenciador de Tarefas no mesmo computador. Compare a versão web e a versão desktop na mesma sala, com o mesmo número de pessoas e os mesmos dispositivos ativos. Some o processo Screenlink e seus subprocessos WebView2 na medição desktop. Na medição web, use uma janela dedicada e registre também o consumo do navegador sem a chamada. Faça medições com a sala parada e durante uma transmissão, após estabilizar por alguns minutos.
