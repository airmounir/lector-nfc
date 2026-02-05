const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { cantidad } = req.body;
    
    // Definir precio: Por ejemplo 1 crédito = 1 EURO (100 céntimos)
    // Puedes cambiar esta lógica. Aquí hacemos 1€ por crédito.
    const precioEnCentimos = cantidad * 100; 

    // Obtenemos la URL actual para saber a dónde volver
    const origin = req.headers.origin || 'https://tu-proyecto.vercel.app';

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: `${cantidad} Créditos de Bebida`,
                            images: ['https://img.icons8.com/color/48/beer.png'], // Icono opcional
                        },
                        unit_amount: precioEnCentimos, // Stripe usa céntimos
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // Al volver, pasamos la cantidad en la URL para que la web sepa qué hacer
            success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}&cantidad_pagada=${cantidad}`,
            cancel_url: `${origin}/?cancelado=true`,
        });

        res.status(200).json({ url: session.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
