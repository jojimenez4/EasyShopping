import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import mysql from "mysql2/promise"; // Importar mysql2 con promesas

dotenv.config();
const app = express();
app.use(express.json());

const { WEBHOOK_VERIFY_TOKEN, GRAPH_API_TOKEN, PORT, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, business_phone_number_id } = process.env;

// Inicializar el estado de los usuarios
const userStates = {};
const PAGE_SIZE = 9;

// Configurar la conexión a MySQL
const dbConnection = await mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "easyshopping",
  port: 3306,
});
console.log("Conexión a la base de datos exitosa!");

// Ruta para validar el webhook con WhatsApp
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook validado correctamente!');
    return res.status(200).send(challenge); // Responder con el challenge para validar
  }

  console.warn('Validación del webhook fallida.');
  return res.sendStatus(403); // No autorizado si el token no coincide
});
// Función para listar productos con paginación
async function listProducts(page) {
  const offset = (page - 1) * PAGE_SIZE;
  const [rows] = await dbConnection.query(`SELECT id, name, price FROM esims_product LIMIT ${PAGE_SIZE} OFFSET ${offset}`);
  return rows;
}
// Función para enviar mensajes con botones interactivos
async function sendInteractiveMessage(userId, messageText, buttons) {
  try {
    const messageData = {
      messaging_product: "whatsapp",
      to: userId,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: messageText,
        },
        action: {
          buttons: buttons,
        },
      },
    };

    const response = await axios.post(
      `https://graph.facebook.com/v12.0/${business_phone_number_id}/messages`,
      messageData,
      {
        headers: {
          Authorization: `Bearer ${GRAPH_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Mensaje con botones enviado:", response.data);
  } catch (error) {
    console.error("Error al enviar el mensaje con botones:", error.response?.data || error.message);
  }
}
// Función para enviar mensajes a través de la API de WhatsApp
async function sendMessage(replyText, userId) {
  try {
    const messageData = {
      messaging_product: "whatsapp",
      to: userId,
      text: { body: replyText },
    };

    const response = await axios.post(`https://graph.facebook.com/v12.0/${business_phone_number_id}/messages`, messageData, {
      headers: {
        'Authorization': `Bearer ${GRAPH_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Mensaje enviado:', response.data);
  } catch (error) {
    console.error('Error al enviar el mensaje:', error.response?.data || error.message);
  }
}
// Función inicio para enviar botones interactivos
async function inicio(userId, replyText) {
  replyText = "Favor selecciona una de las siguientes opciones";
  const buttons = [
    {
      type: "reply",
      reply: {
        id: "1",
        title: "Productos",
      },
    },
    {
      type: "reply",
      reply: {
        id: "2",
        title: "Pedidos",
      },
    },
    {
      type: "reply",
      reply: {
        id: "3",
        title: "Ayuda",
      },
    },
  ];

  // Enviar los botones interactivos usando la función sendInteractiveMessage
  await sendInteractiveMessage(userId, replyText, buttons);
}
// Función postSelect para enviar opciones de pedido con botones interactivos
async function postSelect(userId) {
  // Mensaje que se enviará al usuario
  const replyText = "Selecciona una opción para proceder con tu pedido:";

  // Definición de los botones interactivos
  const buttons = [
    {
      type: "reply",
      reply: {
        id: "confirm",
        title: "Confirmar pedido", // Botón para confirmar el pedido
      },
    },
    {
      type: "reply",
      reply: {
        id: "add_more",
        title: "Agregar más", // Botón para agregar más productos al pedido
      },
    },
    {
      type: "reply",
      reply: {
        id: "cancel",
        title: "Cancelar pedido", // Botón para cancelar el pedido
      },
    },
  ];

  // Enviar el mensaje con los botones interactivos usando la función 'sendInteractiveMessage'
  await sendInteractiveMessage(userId, replyText, buttons);
}
async function productsCall(userId) {
  // Inicializa la página de productos
  userStates[userId].productPage = 1;

  // Obtener productos de la base de datos para la página actual
  const rows = await listProducts(userStates[userId].productPage);

  let replyText;

  // Si hay productos disponibles
  if (rows.length > 0) {
    // Crear la lista de productos formateada
    const productList = rows
      .map((row, index) => `${index + 1}- ${row.name} ($${row.price})`)
      .join("\n");

    // Texto de respuesta con la lista de productos
    replyText = `Los productos disponibles son:\n${productList}\nResponde con un número de la lista o ">" para ver más productos.`;

    // Crear botones para avanzar entre páginas
    const buttons = [
      {
        type: "reply",
        reply: {
          id: ">",
          title: ">",
        },
      },
    ];

    // Enviar el mensaje interactivo con los botones
    await sendInteractiveMessage(userId, replyText, buttons);
  } else {
    // Si no hay productos, se envía un mensaje de error
    replyText = "No encontré productos en la base de datos.";
    await sendMessage(replyText, userId); // Solo mensaje de texto
  }
}


// Maneja los mensajes entrantes
app.post('/webhook', async (req, res) => {
  console.log('Cuerpo de la solicitud:', JSON.stringify(req.body, null, 2)); // Para depuración

  const entry = req.body.entry[0]; // Obtén el primer elemento de 'entry'
  const changes = entry.changes[0]; // Obtén el primer cambio
  const value = changes.value; // Obtén el valor del cambio


  // Verificar que hay mensajes
  if (!value.messages || value.messages.length === 0) {
    return res.sendStatus(200); // No hay mensajes para procesar
  }

  // Determinar el tipo de mensaje (texto o botón interactivo)
  let incomingText = '';
  if (value.messages[0].text) {
    incomingText = value.messages[0].text.body; // Mensaje de texto
  } else if (value.messages[0].interactive) {
    // Si el mensaje es un botón interactivo, obtenemos el texto del botón presionado
    incomingText = value.messages[0].interactive.button_reply.title;
  }

  const userId = value.messages[0].from; // Cambia esto según tu estructura de datos
  console.log('Mensaje entrante:', incomingText); // Para depuración
  console.log('User ID:', userId); // Para depuración

  let replyText;

  // Comprobar si el usuario ya ha sido saludado
  if (!userStates[userId]) {
    userStates[userId] = { hasGreeted: true, inProductSelection: false, inShoppingCart: false, order: [], awaitingQuantity: false, awaitingName: false };

    replyText = "Hola, bienvenido a Easy Shopping!";
    await sendMessage(replyText, userId); // Solo mensaje de texto
    await inicio(userId, replyText);

    return res.sendStatus(200); // Solo enviar la respuesta una vez
  }
  // Aquí se manejan los mensajes después del saludo
  if (incomingText.includes("Productos") || incomingText.includes("producto") && !(userStates[userId]?.inProductSelection)) {
    // Iniciar la selección de productos y mostrar la primera página
    if (!userStates[userId].inProductSelection) {
      userStates[userId].inProductSelection = true;
      await productsCall(userId);
    }
  }
  else if (incomingText === "Pedidos" && !(userStates[userId]?.inProductSelection)) {
    if (userStates[userId].order.length > 0) {
      replyText = "Aquí tienes tus pedidos:\n"
      await sendMessage(replyText, userId); // Solo mensaje de texto
    }
    else {
      replyText = "No tienes pedidos registrados.";
      await sendMessage(replyText, userId); // Solo mensaje de texto
    }

  }
  else if (incomingText === "Ayuda" && !(userStates[userId]?.inProductSelection)) {

    replyText = "ahora lo contactaremos.";
    await sendMessage(replyText, userId); // Solo mensaje de texto
  }
  else if (userStates[userId]?.inProductSelection) {
    // Selección de producto para agregar al pedido
    const productIndex = parseInt(incomingText) - 1;
    const products = await listProducts(userStates[userId].productPage);

    if (productIndex >= 0 && productIndex < products.length && !(userStates[userId]?.awaitingQuantity)) {
      const selectedProduct = products[productIndex];
      // Indicar que ahora estamos esperando la cantidad
      userStates[userId].awaitingQuantity = true;
      userStates[userId].selectedProduct = selectedProduct; // Guardamos el producto seleccionado
      replyText = `Has seleccionado ${selectedProduct.name}. ¿Cuántas unidades deseas agregar?`;
      await sendMessage(replyText, userId); // Preguntar la cantidad
    }
    else if (userStates[userId]?.awaitingQuantity) {
      // El usuario ha seleccionado un producto y está esperando la cantidad
      const quantity = parseInt(incomingText);

      if (isNaN(quantity) || quantity <= 0) {
        replyText = "Por favor, ingresa una cantidad válida.";
        await sendMessage(replyText, userId); // Solo mensaje de texto
      }
      else if (quantity > 0) {
        const selectedProduct = userStates[userId].selectedProduct;
        selectedProduct.quantity = quantity; // Guardamos la cantidad

        // Agregar el producto y la cantidad al pedido
        userStates[userId].order.push({ ...selectedProduct, quantity });

        replyText = `${selectedProduct.name} x ${quantity} ha sido agregado a tu pedido.`;
        await sendMessage(replyText, userId); // Confirmación del agregado

        // Restablecer la variable de espera de cantidad
        userStates[userId].awaitingQuantity = false;
        userStates[userId].selectedProduct = false; // Limpiar el producto seleccionado
        userStates[userId].inProductSelection = false;
        userStates[userId].inShoppingCart = true;

        // Mostrar opciones para continuar
        await postSelect(userId);

      }
    }
    else if (userStates[userId]?.inProductSelection && (incomingText === ">" || incomingText === "<")) {
      // Navegar a la siguiente página de productos
      if (incomingText === ">") {
        userStates[userId].productPage += 1;
      }
      else if (incomingText === "<" && userStates[userId].productPage > 1) {
        userStates[userId].productPage -= 1;
      }

      const rows = await listProducts(userStates[userId].productPage);

      if (rows.length > 0) {
        const productList = rows.map((row, index) => `${index + 1 + (PAGE_SIZE * (userStates[userId].productPage - 1))}- ${row.name} ($${row.price})`).join("\n");
        replyText = `${productList}\nResponde con un número de la lista o ">" para ver más productos.`;

        // Construir los botones con la flecha hacia atrás solo si la página es mayor que 1
        const buttons = [
          {
            type: "reply",
            reply: {
              id: ">",
              title: ">",
            },
          },
        ];

        // Agregar el botón de retroceso solo si la página es mayor a 1
        if (userStates[userId].productPage > 1) {
          buttons.unshift({
            type: "reply",
            reply: {
              id: "<",
              title: "<",
            },
          });
        }

        await sendInteractiveMessage(userId, replyText, buttons);
      } else {
        replyText = "No hay más productos disponibles.";
        await sendMessage(replyText, userId); // Enviar solo mensaje de texto
      }
    }
    else {
      replyText = "Selección inválida. Por favor, responde con un número válido.";
      await sendMessage(replyText, userId); // Solo mensaje de texto
    }

  }

  else if (userStates[userId]?.inShoppingCart) {
    if (incomingText === "Confirmar pedido") {
      if (userStates[userId].order.length === 0) {
        // Caso en el que no hay productos en el pedido
        replyText = "No tienes productos en tu pedido.";
        await sendMessage(replyText, userId);
        return;  // Detener la ejecución si no hay productos
      }
  
      // Generar un resumen del pedido
      let total = 0;
      let orderSummary = "Tu pedido confirmado incluye:\n\n";
  
      userStates[userId].order.forEach((item, index) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        orderSummary += `${index + 1}. -${item.id}  ${item.name} - ${item.quantity} unidad(es) x $${item.price} = $${subtotal.toFixed(2)}\n`;
      });
  
      orderSummary += `\nTotal: $${total.toFixed(2)}`;
  
      // Enviar el resumen del pedido
      await sendMessage(orderSummary, userId);
  
      // Confirmar el pedido
      replyText = "¡Gracias por tu pedido! Te contactaremos pronto para el envío.";
      await sendMessage(replyText, userId);
  
      // Obtener la fecha y hora actual
      const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
      // Asumir que tienes el `contactId` (es necesario que esté definido previamente)
      const contactId = userStates[userId]?.contactId;
  
      // Insertar los productos en la base de datos
      try {
        // Inserción en la tabla esims_sale para registrar la venta
        const [saleResult] = await dbConnection.query(
          `INSERT INTO esims_sale (fecha_venta, estado_pedido, id_contacto_id) 
           VALUES (?, ?, ?)`,
          [currentDate, 'Confirmado', contactId]
        );
  
        // Obtener el ID de la venta recién insertada
        const insertedSaleId = saleResult.insertId;  // Asegurarse de obtener el ID generado
  
        if (!insertedSaleId) {
          throw new Error("No se generó un ID de venta válido.");
        }
  
        // Insertar los detalles de la venta en esims_saledetail y actualizar el stock
        for (const item of userStates[userId].order) {
          // Verificar existencia del producto y stock
          const [productResult] = await dbConnection.query(
            `SELECT * FROM esims_product WHERE id = ?`,
            [item.id]
          );
  
          if (productResult.length === 0) {
            console.log(`Producto con ID ${item.id} no encontrado`);
            await sendMessage(`El producto con ID ${item.id} no existe.`, userId);
            continue;
          }
  
          const product = productResult[0];
  
          if (product.stock >= item.quantity) {
            console.log(`Stock suficiente para ${product.name}`);
            
            // Si hay suficiente stock, procedemos a insertar el detalle de la venta
            const total = product.price * item.quantity; // Calcular el total para esta línea
  
            // Insertar el detalle de la venta en esims_saledetail
            console.log(`Insertando detalle de venta:`, [
              insertedSaleId,
              product.id,
              item.quantity,
              product.price,
              total
            ]);
  
            await dbConnection.query(
              `INSERT INTO esims_saledetail (id_venta_id, id_product_id, cantidad, precio_unitario, total) 
               VALUES (?, ?, ?, ?, ?)`,
              [insertedSaleId, product.id, item.quantity, product.price, total]
            );
  
            // Actualizar el stock del producto en esims_product
            await dbConnection.query(
              `UPDATE esims_product SET stock = stock - ? WHERE id = ?`,
              [item.quantity, product.id]
            );
          } else {
            console.log(`No hay suficiente stock para ${product.name}`);
            await sendMessage(`No hay suficiente stock para el producto ${product.name}.`, userId);
          }
        }
  
        // Vaciar el carrito y reiniciar el estado
        userStates[userId].inShoppingCart = false;
        userStates[userId].hasGreeted = false;
        userStates[userId].order = []; // Vaciar el carrito
  
        replyText = "Pedido generado correctamente";
        await sendMessage(replyText, userId);
        console.log('Todos los productos fueron insertados con éxito');
      } catch (error) {
        replyText = "Error al generar el pedido";
        await sendMessage(replyText, userId);
        console.error('Error al insertar productos:', error);
      }
    }
  
    else if (incomingText === "Agregar más") {
      userStates[userId].inShoppingCart = false;
      userStates[userId].inProductSelection = true;
      await productsCall(userId);
    }

    else if (incomingText === "Cancelar pedido") {
      userStates[userId].inShoppingCart = false;
      userStates[userId].inProductSelection = false;
      userStates[userId].order = [];
      userStates[userId].awaitingName = false;
      userStates[userId].awaitingQuantity = false;
      await inicio(userId);
    }
    else {
      replyText = "No te he entendido ";
      await sendMessage(replyText, userId); // Solo mensaje de texto
      await postSelect(userId);

    }
  }
  else {
    replyText = "No te he entendido";
    await sendMessage(replyText, userId); // Solo mensaje de texto
    await inicio(userId, replyText);
  }
  return res.sendStatus(200);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});