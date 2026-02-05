const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER, 
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Solo POST' });
    }

    // AHORA RECIBIMOS TAMBIÉN LA CANTIDAD
    const { serialNumber, cantidad } = req.body;

    if (!serialNumber || !cantidad) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    try {
        let pool = await sql.connect(config);

        // Usamos @cantidad en la consulta SQL en lugar de un "1" fijo
        const result = await pool.request()
            .input('id', sql.NVarChar, serialNumber)
            .input('cantidad', sql.Int, cantidad) // Aquí definimos la variable
            .query(`
                MERGE INTO Tarjetas AS Target
                USING (SELECT @id AS ID) AS Source
                ON (Target.ID = Source.ID)
                WHEN MATCHED THEN
                    UPDATE SET Creditos = Creditos + @cantidad, UltimoUso = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (ID, Creditos, UltimoUso) VALUES (@id, @cantidad, GETDATE());
                
                SELECT Creditos FROM Tarjetas WHERE ID = @id;
            `);

        const nuevosCreditos = result.recordset[0].Creditos;
        await pool.close();

        return res.status(200).json({ success: true, nuevosCreditos });

    } catch (error) {
        console.error('Error SQL:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
