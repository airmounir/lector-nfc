const sql = require('mssql');

// Configuración de la conexión (usaremos variables de entorno por seguridad)
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER, 
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: true,
        trustServerCertificate: true // Necesario para algunos servidores cloud
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Solo se permite método POST' });
    }

    const { serialNumber } = req.body;

    if (!serialNumber) {
        return res.status(400).json({ error: 'Falta el número de serie' });
    }

    try {
        // Conectar a SQL Server
        let pool = await sql.connect(config);

        // Lógica: Si existe, suma 1 crédito. Si no, crea la tarjeta con 1 crédito.
        const result = await pool.request()
            .input('id', sql.NVarChar, serialNumber)
            .query(`
                MERGE INTO Tarjetas AS Target
                USING (SELECT @id AS ID) AS Source
                ON (Target.ID = Source.ID)
                WHEN MATCHED THEN
                    UPDATE SET Creditos = Creditos + 1, UltimoUso = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (ID, Creditos, UltimoUso) VALUES (@id, 1, GETDATE());
                
                SELECT Creditos FROM Tarjetas WHERE ID = @id;
            `);

        // Devolver el nuevo saldo
        const nuevosCreditos = result.recordset[0].Creditos;
        
        // Cerrar conexión (opcional en serverless, pero buena práctica)
        await pool.close();

        return res.status(200).json({ success: true, nuevosCreditos });

    } catch (error) {
        console.error('Error SQL:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}