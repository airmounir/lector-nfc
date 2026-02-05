const sql = require('mssql');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER, 
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: { encrypt: true, trustServerCertificate: true }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

    const { serialNumber, cantidad, sessionId } = req.body;

    if (!serialNumber || !cantidad || !sessionId) {
        return res.status(400).json({ error: 'Faltan datos (ID, cantidad o pago)' });
    }

    try {
        // 1. SEGURIDAD: Verificar el pago con Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        if (session.payment_status !== 'paid') {
            return res.status(403).json({ error: 'El pago no se ha completado.' });
        }

        // 2. Conectar a Base de Datos
        let pool = await sql.connect(config);

        // 3. Sumar créditos
        const result = await pool.request()
            .input('id', sql.NVarChar, serialNumber)
            .input('cantidad', sql.Int, cantidad)
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
        console.error('Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
