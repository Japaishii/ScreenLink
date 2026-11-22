using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        var originFile = Path.Combine(AppContext.BaseDirectory, "servidor.txt");
        var address = File.Exists(originFile) ? File.ReadAllText(originFile).Trim() : "http://localhost:3000";
        if (!Uri.TryCreate(address, UriKind.Absolute, out var server) ||
            (server.Scheme != Uri.UriSchemeHttps && !(server.Scheme == Uri.UriSchemeHttp && server.IsLoopback)) ||
            server.UserInfo.Length != 0 || server.PathAndQuery != "/" || server.Fragment.Length != 0)
        {
            MessageBox.Show("Informe a origem HTTPS do Screenlink em servidor.txt. HTTP só é aceito para testes locais.", "Screenlink");
            return;
        }

        using var window = new DesktopWindow();
        var web = window.Web;
        window.Shown += async (_, _) =>
        {
            try
            {
                var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Screenlink", "WebView2");
                await web.EnsureCoreWebView2Async(await CoreWebView2Environment.CreateAsync(userDataFolder: profile));
                var core = web.CoreWebView2;
                core.Settings.AreHostObjectsAllowed = false;
                core.Settings.IsWebMessageEnabled = false;
                core.Settings.AreDevToolsEnabled = false;
                core.NewWindowRequested += (_, args) =>
                {
                    args.Handled = true;
                    if (Uri.TryCreate(args.Uri, UriKind.Absolute, out var target) && SameOrigin(target) &&
                        target.AbsolutePath is "/termos" or "/privacidade")
                    {
                        Process.Start(new ProcessStartInfo(target.AbsoluteUri) { UseShellExecute = true });
                    }
                };
                core.NavigationStarting += (_, args) =>
                {
                    args.Cancel = !Uri.TryCreate(args.Uri, UriKind.Absolute, out var target) ||
                        !SameOrigin(target) || target.AbsolutePath.TrimEnd('/') != "/desktop";
                };
                core.NavigationCompleted += (_, args) =>
                {
                    if (!args.IsSuccess && args.WebErrorStatus != CoreWebView2WebErrorStatus.OperationCanceled)
                        MessageBox.Show(window, $"Não foi possível abrir {server.Host}. Verifique a conexão e abra o Screenlink novamente.", "Screenlink");
                };
                core.Navigate(new Uri(server, "/desktop").AbsoluteUri);
            }
            catch (WebView2RuntimeNotFoundException)
            {
                MessageBox.Show(window, "Instale o Microsoft Edge WebView2 Runtime e abra o Screenlink novamente.", "Screenlink");
                window.Close();
            }
            catch (Exception error)
            {
                MessageBox.Show(window, $"O Screenlink não pôde iniciar. {error.Message}", "Screenlink");
                window.Close();
            }
        };
        Application.Run(window);

        bool SameOrigin(Uri target) => target.Scheme == server.Scheme && target.Host == server.Host && target.Port == server.Port;
    }
}
