namespace WindowsInventoryDemo;

internal static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var form = new MainForm();
        int i = Array.IndexOf(args, "--screenshot");
        if (i >= 0 && i + 1 < args.Length)
        {
            form.SaveScreenshot(args[i + 1]);
            return;
        }
        Application.Run(form);
    }
}
