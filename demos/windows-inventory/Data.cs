namespace WindowsInventoryDemo;

public record Product(string Sku, string Name, string Category, int Stock, int Min, int Price)
{
    public string Status => Stock == 0 ? "Agotado" : Stock < Min ? "Stock bajo" : "Disponible";
}

public static class Data
{
    public static readonly List<Product> Products = new()
    {
        new("LUM-1001", "Panel LED 60x60 40W", "Iluminación", 148, 40, 24990),
        new("LUM-1002", "Foco LED E27 12W", "Iluminación", 620, 200, 2490),
        new("LUM-1003", "Reflector exterior 100W", "Iluminación", 18, 30, 17990),
        new("CAB-2001", "Cable THHN 2.5mm (100m)", "Cables", 64, 25, 38500),
        new("CAB-2002", "Cable USB-C 2m", "Cables", 0, 50, 6990),
        new("SEN-3001", "Sensor de movimiento PIR", "Sensores", 92, 30, 8990),
        new("SEN-3002", "Sensor de temperatura WiFi", "Sensores", 27, 40, 12990),
        new("CTL-4001", "Controlador DMX 512", "Control", 35, 10, 89990),
        new("CTL-4002", "Dimmer inteligente 300W", "Control", 8, 15, 21990),
        new("PWR-5001", "Fuente 12V 10A", "Energía", 210, 60, 14990),
        new("PWR-5002", "UPS 650VA", "Energía", 41, 20, 54990),
        new("ACC-6001", "Soporte metálico ajustable", "Accesorios", 330, 100, 3990),
    };

    public static readonly (string Month, int Value)[] Movement =
    {
        ("Ene", 420), ("Feb", 380), ("Mar", 510), ("Abr", 470), ("May", 560), ("Jun", 610),
        ("Jul", 580), ("Ago", 650), ("Sep", 720), ("Oct", 690), ("Nov", 780), ("Dic", 840),
    };
}
