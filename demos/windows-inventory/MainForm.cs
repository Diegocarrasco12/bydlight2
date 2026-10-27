using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Globalization;

namespace WindowsInventoryDemo;

public class MainForm : Form
{
    static readonly Color Bg = Color.FromArgb(15, 17, 23);
    static readonly Color Side = Color.FromArgb(11, 13, 18);
    static readonly Color Card = Color.FromArgb(24, 27, 36);
    static readonly Color Line = Color.FromArgb(42, 46, 58);
    static readonly Color Orange = Color.FromArgb(255, 106, 0);
    static readonly Color Blue = Color.FromArgb(46, 134, 255);
    static readonly Color TextC = Color.FromArgb(235, 238, 245);
    static readonly Color Muted = Color.FromArgb(142, 150, 168);
    static readonly Color Green = Color.FromArgb(52, 199, 123);
    static readonly Color Red = Color.FromArgb(240, 82, 82);
    static readonly CultureInfo Cl = new("es-CL");

    readonly DataGridView grid = new();
    readonly Panel chart = new();
    int active = 0;
    readonly string[] menu = { "Panel de control", "Inventario", "Pedidos", "Proveedores", "Reportes" };

    public MainForm()
    {
        Text = "Bydlight Inventario - Demo";
        Font = new Font("Segoe UI", 9.5f);
        BackColor = Bg;
        ForeColor = TextC;
        StartPosition = FormStartPosition.CenterScreen;
        AutoScaleMode = AutoScaleMode.None;
        ClientSize = new Size(1360, 820);
        MinimumSize = new Size(1100, 700);
        DoubleBuffered = true;

        var side = new Panel { Dock = DockStyle.Left, Width = 230, BackColor = Side };
        side.Paint += PaintSide;
        side.MouseClick += (s, e) =>
        {
            int idx = (e.Y - 130) / 46;
            if (e.Y >= 130 && idx < menu.Length) { active = idx; side.Invalidate(); Controls[0].Invalidate(true); }
        };

        var foot = new Panel { Dock = DockStyle.Bottom, Height = 32, BackColor = Side };
        foot.Paint += (s, e) =>
        {
            e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            using var f = new Font("Segoe UI", 8.5f);
            TextRenderer.DrawText(e.Graphics, "DEMO - datos ficticios", f, new Point(16, 8), Muted);
            TextRenderer.DrawText(e.Graphics, "Bydlight  |  v1.0 demo", f, new Rectangle(0, 0, foot.Width - 16, foot.Height),
                Muted, TextFormatFlags.Right | TextFormatFlags.VerticalCenter);
        };

        var content = new Panel { Dock = DockStyle.Fill, BackColor = Bg, Padding = new Padding(28, 20, 28, 16) };

        var header = new Panel { Dock = DockStyle.Top, Height = 64, BackColor = Bg };
        header.Paint += (s, e) =>
        {
            e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            using var h = new Font("Segoe UI Semibold", 20f);
            using var sm = new Font("Segoe UI", 10f);
            using var bf = new Font("Segoe UI Semibold", 10f);
            TextRenderer.DrawText(e.Graphics, menu[active], h, new Point(0, 0), TextC);
            TextRenderer.DrawText(e.Graphics, "Resumen de inventario - sucursal Santiago", sm, new Point(2, 38), Muted);
            var r = new Rectangle(header.Width - 150, 14, 150, 36);
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var br = new SolidBrush(Orange);
            using var gp = Round(r, 8);
            e.Graphics.FillPath(br, gp);
            TextRenderer.DrawText(e.Graphics, "+ Nuevo pedido", bf, r, Color.White,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        };

        var kpis = new Panel { Dock = DockStyle.Top, Height = 112, BackColor = Bg };
        int total = Data.Products.Count;
        int low = Data.Products.Count(p => p.Stock < p.Min);
        long value = Data.Products.Sum(p => (long)p.Stock * p.Price);
        var items = new (string, string, string, Color)[]
        {
            ("Productos", total.ToString(), "+3 este mes", Blue),
            ("Stock bajo", low.ToString(), "Requieren reposición", Red),
            ("Pedidos pendientes", "17", "5 llegan esta semana", Orange),
            ("Valor de inventario", "$ " + value.ToString("N0", Cl), "CLP", Green),
        };
        kpis.Paint += (s, e) =>
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            int gap = 16, w = (kpis.Width - gap * 3) / 4;
            using var fl = new Font("Segoe UI", 9.5f);
            using var fv = new Font("Segoe UI Semibold", 22f);
            using var fs = new Font("Segoe UI", 9f);
            for (int i = 0; i < 4; i++)
            {
                var r = new Rectangle(i * (w + gap), 4, w, 100);
                DrawCard(g, r);
                using (var b = new SolidBrush(items[i].Item4)) g.FillRectangle(b, r.X, r.Y + 18, 4, 64);
                TextRenderer.DrawText(g, items[i].Item1, fl, new Point(r.X + 20, r.Y + 14), Muted);
                TextRenderer.DrawText(g, items[i].Item2, fv, new Point(r.X + 18, r.Y + 36), TextC);
                TextRenderer.DrawText(g, items[i].Item3, fs, new Point(r.X + 20, r.Y + 76), items[i].Item4);
            }
        };
        kpis.Resize += (s, e) => kpis.Invalidate();

        var body = new Panel { Dock = DockStyle.Fill, BackColor = Bg, Padding = new Padding(0, 12, 0, 0) };
        chart.Dock = DockStyle.Right;
        chart.Width = 400;
        chart.BackColor = Bg;
        chart.Paint += PaintChart;
        chart.Resize += (s, e) => chart.Invalidate();
        var spacer = new Panel { Dock = DockStyle.Right, Width = 16, BackColor = Bg };

        var gridHost = new Panel { Dock = DockStyle.Fill, BackColor = Card, Padding = new Padding(1, 44, 1, 1) };
        gridHost.Paint += (s, e) =>
        {
            e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            using var p = new Pen(Line);
            e.Graphics.DrawRectangle(p, 0, 0, gridHost.Width - 1, gridHost.Height - 1);
            using var f = new Font("Segoe UI Semibold", 11f);
            TextRenderer.DrawText(e.Graphics, "Inventario de productos", f, new Point(16, 10), TextC);
        };
        SetupGrid();
        gridHost.Controls.Add(grid);

        body.Controls.Add(gridHost);
        body.Controls.Add(spacer);
        body.Controls.Add(chart);

        content.Controls.Add(body);
        content.Controls.Add(kpis);
        content.Controls.Add(header);

        Controls.Add(content);
        Controls.Add(foot);
        Controls.Add(side);
    }

    static GraphicsPath Round(Rectangle r, int rad)
    {
        var p = new GraphicsPath();
        int d = rad * 2;
        p.AddArc(r.X, r.Y, d, d, 180, 90);
        p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    static void DrawCard(Graphics g, Rectangle r)
    {
        using var p = Round(r, 10);
        using var b = new SolidBrush(Card);
        using var pen = new Pen(Line);
        g.FillPath(b, p);
        g.DrawPath(pen, p);
    }

    void PaintSide(object? sender, PaintEventArgs e)
    {
        var g = e.Graphics;
        var pnl = (Panel)sender!;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
        using (var b = new SolidBrush(Orange)) g.FillEllipse(b, 22, 28, 38, 38);
        using (var b = new SolidBrush(Blue)) g.FillPie(b, new Rectangle(22, 28, 38, 38), 90, 180);
        using (var b = new SolidBrush(Side)) g.FillEllipse(b, 31, 37, 20, 20);
        using var logo = new Font("Segoe UI Semibold", 16f);
        TextRenderer.DrawText(g, "Bydlight", logo, new Point(68, 26), TextC);
        using var sub = new Font("Segoe UI", 8.5f);
        TextRenderer.DrawText(g, "INVENTARIO", sub, new Point(70, 56), Orange);
        using var f = new Font("Segoe UI", 10.5f);
        for (int i = 0; i < menu.Length; i++)
        {
            var r = new Rectangle(12, 130 + i * 46, 206, 40);
            if (i == active)
            {
                using var p = Round(r, 8);
                using var b = new SolidBrush(Color.FromArgb(40, 255, 106, 0));
                g.FillPath(b, p);
                using var o = new SolidBrush(Orange);
                g.FillRectangle(o, 0, r.Y + 8, 4, 24);
            }
            using var ib = new SolidBrush(i == active ? Orange : Muted);
            g.FillRectangle(ib, r.X + 16, r.Y + 14, 12, 12);
            TextRenderer.DrawText(g, menu[i], f, new Point(r.X + 40, r.Y + 9), i == active ? TextC : Muted);
        }
        int y = pnl.Height - 70;
        using var chip = new SolidBrush(Card);
        g.FillRectangle(chip, 12, y, 206, 54);
        using var ob = new SolidBrush(Blue);
        g.FillEllipse(ob, 24, y + 10, 34, 34);
        TextRenderer.DrawText(g, "DU", sub, new Point(31, y + 19), Color.White);
        TextRenderer.DrawText(g, "Usuario Demo", f, new Point(68, y + 6), TextC);
        TextRenderer.DrawText(g, "Administrador", sub, new Point(68, y + 28), Muted);
    }

    void PaintChart(object? sender, PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
        var r = new Rectangle(0, 0, chart.Width - 1, chart.Height - 1);
        DrawCard(g, r);
        using var tf = new Font("Segoe UI Semibold", 11f);
        using var sf = new Font("Segoe UI", 8.5f);
        TextRenderer.DrawText(g, "Movimiento mensual", tf, new Point(16, 10), TextC);
        TextRenderer.DrawText(g, "Unidades despachadas (datos de ejemplo)", sf, new Point(17, 34), Muted);

        var area = new Rectangle(52, 84, r.Width - 76, r.Height - 84 - 40);
        int max = 1000;
        using var gl = new Pen(Line);
        for (int i = 0; i <= 4; i++)
        {
            int y = area.Bottom - i * area.Height / 4;
            g.DrawLine(gl, area.X, y, area.Right, y);
            TextRenderer.DrawText(g, (max / 4 * i).ToString(), sf, new Rectangle(8, y - 9, 40, 18), Muted,
                TextFormatFlags.Right | TextFormatFlags.VerticalCenter);
        }
        int n = Data.Movement.Length;
        float slot = (float)area.Width / n;
        float bw = slot * 0.58f;
        for (int i = 0; i < n; i++)
        {
            var (m, v) = Data.Movement[i];
            float h = area.Height * v / max;
            var br = new RectangleF(area.X + i * slot + (slot - bw) / 2, area.Bottom - h, bw, h);
            bool hi = i == n - 1;
            using var lb = new LinearGradientBrush(br, hi ? Orange : Blue, hi ? Color.FromArgb(200, 70, 0) : Color.FromArgb(25, 90, 190), 90f);
            g.FillRectangle(lb, br);
            TextRenderer.DrawText(g, m, sf, new Rectangle((int)(area.X + i * slot) - 4, area.Bottom + 6, (int)slot + 8, 18), Muted,
                TextFormatFlags.HorizontalCenter);
        }
        TextRenderer.DrawText(g, "840", sf, new Rectangle((int)(area.X + (n - 1) * slot) - 10, (int)(area.Bottom - area.Height * 840f / max) - 20, (int)slot + 20, 18),
            Orange, TextFormatFlags.HorizontalCenter);
    }

    void SetupGrid()
    {
        grid.Dock = DockStyle.Fill;
        grid.BorderStyle = BorderStyle.None;
        grid.BackgroundColor = Card;
        grid.GridColor = Line;
        grid.CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal;
        grid.EnableHeadersVisualStyles = false;
        grid.ColumnHeadersBorderStyle = DataGridViewHeaderBorderStyle.None;
        grid.RowHeadersVisible = false;
        grid.AllowUserToAddRows = false;
        grid.AllowUserToResizeRows = false;
        grid.ReadOnly = true;
        grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        grid.ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.DisableResizing;
        grid.ColumnHeadersHeight = 36;
        grid.RowTemplate.Height = 38;
        grid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
        grid.DefaultCellStyle = new DataGridViewCellStyle
        {
            BackColor = Card, ForeColor = TextC, SelectionBackColor = Color.FromArgb(40, 44, 58),
            SelectionForeColor = TextC, Padding = new Padding(8, 0, 4, 0), Font = new Font("Segoe UI", 9.5f)
        };
        grid.AlternatingRowsDefaultCellStyle = new DataGridViewCellStyle(grid.DefaultCellStyle) { BackColor = Color.FromArgb(28, 31, 41) };
        grid.ColumnHeadersDefaultCellStyle = new DataGridViewCellStyle
        {
            BackColor = Color.FromArgb(19, 21, 29), ForeColor = Muted, SelectionBackColor = Color.FromArgb(19, 21, 29),
            SelectionForeColor = Muted, Padding = new Padding(8, 0, 4, 0), Font = new Font("Segoe UI Semibold", 9f)
        };

        void Col(string name, string head, float w, bool right = false)
        {
            var c = new DataGridViewTextBoxColumn { Name = name, HeaderText = head, FillWeight = w };
            if (right)
            {
                c.DefaultCellStyle = new DataGridViewCellStyle { Alignment = DataGridViewContentAlignment.MiddleRight };
                c.HeaderCell.Style = new DataGridViewCellStyle(grid.ColumnHeadersDefaultCellStyle) { Alignment = DataGridViewContentAlignment.MiddleRight };
            }
            grid.Columns.Add(c);
        }
        Col("sku", "SKU", 80); Col("name", "PRODUCTO", 190); Col("cat", "CATEGORÍA", 90);
        Col("stock", "STOCK", 60, true); Col("min", "MÍN.", 55, true); Col("price", "PRECIO", 80, true); Col("st", "ESTADO", 90);
        foreach (var p in Data.Products)
            grid.Rows.Add(p.Sku, p.Name, p.Category, p.Stock, p.Min, "$ " + p.Price.ToString("N0", Cl), p.Status);
        foreach (DataGridViewRow row in grid.Rows)
            foreach (var cn in new[] { "stock", "min", "price" })
                row.Cells[cn].Style.Alignment = DataGridViewContentAlignment.MiddleRight;
        grid.CellFormatting += (s, e) =>
        {
            if (e.RowIndex >= 0 && grid.Columns[e.ColumnIndex].Name == "st")
            {
                var c = e.Value?.ToString() switch { "Disponible" => Green, "Stock bajo" => Orange, _ => Red };
                e.CellStyle!.ForeColor = c;
                e.CellStyle.Font = new Font("Segoe UI Semibold", 9.5f);
            }
        };
    }

    public void SaveScreenshot(string path)
    {
        StartPosition = FormStartPosition.Manual;
        Location = new Point(-3000, -3000);
        ShowInTaskbar = false;
        CreateControl();
        Show();
        ClientSize = new Size(1360, 820);
        PerformLayout();
        grid.ClearSelection();
        Application.DoEvents();
        using var full = new Bitmap(Width, Height);
        DrawToBitmap(full, new Rectangle(0, 0, Width, Height));
        var cl = PointToScreen(Point.Empty);
        var rect = new Rectangle(cl.X - Left, cl.Y - Top, ClientSize.Width, ClientSize.Height);
        using var crop = full.Clone(rect, full.PixelFormat);
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        crop.Save(path, System.Drawing.Imaging.ImageFormat.Png);
        Close();
    }
}
