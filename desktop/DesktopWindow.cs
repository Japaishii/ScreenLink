using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.WinForms;

internal sealed class DesktopWindow : Form
{
    private const int ResizeBorder = 5;
    private const int NonClientHitTest = 0x0084;
    private const int NonClientMouseDown = 0x00A1;
    private const int CaptionHit = 2;
    private static readonly Color Background = Color.FromArgb(23, 25, 34);
    private static readonly Color Hover = Color.FromArgb(48, 52, 68);
    private readonly Button maximizeButton;

    public WebView2 Web { get; } = new()
    {
        Dock = DockStyle.Fill,
        DefaultBackgroundColor = Background,
    };

    public DesktopWindow()
    {
        Text = "Screenlink";
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterScreen;
        Size = new Size(1200, 800);
        MinimumSize = new Size(640, 480);
        BackColor = Background;
        Padding = new Padding(ResizeBorder);

        var caption = new Panel { Dock = DockStyle.Top, Height = 34, BackColor = Background };
        caption.MouseDown += DragCaption;
        caption.MouseDoubleClick += (_, args) =>
        {
            if (args.Button == MouseButtons.Left) ToggleMaximize();
        };
        var minimizeButton = CreateButton("Minimizar", (_, graphics, bounds, pen) =>
            graphics.DrawLine(pen, bounds.Left, bounds.Top + 5, bounds.Right, bounds.Top + 5));
        minimizeButton.Click += (_, _) => WindowState = FormWindowState.Minimized;

        maximizeButton = CreateButton("Maximizar", (window, graphics, bounds, pen) =>
        {
            if (window.WindowState == FormWindowState.Maximized)
            {
                graphics.DrawLines(pen, [
                    new Point(bounds.Left + 2, bounds.Top + 3),
                    new Point(bounds.Left + 2, bounds.Top),
                    new Point(bounds.Right, bounds.Top),
                    new Point(bounds.Right, bounds.Bottom - 2),
                    new Point(bounds.Right - 3, bounds.Bottom - 2),
                ]);
                graphics.DrawRectangle(pen, bounds.Left, bounds.Top + 3, 7, 7);
                return;
            }
            graphics.DrawRectangle(pen, bounds);
        });
        maximizeButton.Click += (_, _) => ToggleMaximize();

        var closeButton = CreateButton("Fechar", (_, graphics, bounds, pen) =>
        {
            graphics.DrawLine(pen, bounds.Left, bounds.Top, bounds.Right, bounds.Bottom);
            graphics.DrawLine(pen, bounds.Right, bounds.Top, bounds.Left, bounds.Bottom);
        }, Color.FromArgb(175, 47, 64));
        closeButton.Click += (_, _) => Close();

        caption.Controls.Add(minimizeButton);
        caption.Controls.Add(maximizeButton);
        caption.Controls.Add(closeButton);
        Controls.Add(Web);
        Controls.Add(caption);

        Resize += (_, _) =>
        {
            bool maximized = WindowState == FormWindowState.Maximized;
            Padding = maximized ? Padding.Empty : new Padding(ResizeBorder);
            maximizeButton.AccessibleName = maximized ? "Restaurar" : "Maximizar";
            maximizeButton.Invalidate();
        };
    }

    private Button CreateButton(string name, Action<DesktopWindow, Graphics, Rectangle, Pen> draw, Color? hover = null)
    {
        var button = new Button
        {
            AccessibleName = name,
            Dock = DockStyle.Right,
            Width = 46,
            FlatStyle = FlatStyle.Flat,
            BackColor = Background,
            ForeColor = Color.FromArgb(225, 229, 243),
            UseVisualStyleBackColor = false,
        };
        button.FlatAppearance.BorderSize = 0;
        button.FlatAppearance.MouseOverBackColor = hover ?? Hover;
        button.FlatAppearance.MouseDownBackColor = hover ?? Hover;
        button.Paint += (_, args) =>
        {
            using var pen = new Pen(button.ForeColor);
            var glyph = new Rectangle((button.ClientSize.Width - 10) / 2, (button.ClientSize.Height - 10) / 2, 10, 10);
            draw(this, args.Graphics, glyph, pen);
        };
        return button;
    }

    private void ToggleMaximize()
    {
        if (WindowState == FormWindowState.Maximized)
        {
            WindowState = FormWindowState.Normal;
            return;
        }

        MaximizedBounds = Screen.FromControl(this).WorkingArea;
        WindowState = FormWindowState.Maximized;
    }

    private void DragCaption(object? sender, MouseEventArgs args)
    {
        if (args.Button != MouseButtons.Left || args.Clicks != 1) return;
        ReleaseCapture();
        SendMessage(Handle, NonClientMouseDown, CaptionHit, IntPtr.Zero);
    }

    protected override void WndProc(ref Message message)
    {
        base.WndProc(ref message);
        if (message.Msg != NonClientHitTest || WindowState != FormWindowState.Normal) return;

        long coordinates = message.LParam.ToInt64();
        var cursor = PointToClient(new Point((short)(coordinates & 0xffff), (short)((coordinates >> 16) & 0xffff)));
        bool left = cursor.X < ResizeBorder;
        bool right = cursor.X >= ClientSize.Width - ResizeBorder;
        bool top = cursor.Y < ResizeBorder;
        bool bottom = cursor.Y >= ClientSize.Height - ResizeBorder;
        int hit = (left, right, top, bottom) switch
        {
            (true, _, true, _) => 13,
            (_, true, true, _) => 14,
            (true, _, _, true) => 16,
            (_, true, _, true) => 17,
            (true, _, _, _) => 10,
            (_, true, _, _) => 11,
            (_, _, true, _) => 12,
            (_, _, _, true) => 15,
            _ => 0,
        };
        if (hit != 0) message.Result = hit;
    }

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll", EntryPoint = "SendMessageW")]
    private static extern IntPtr SendMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);
}
