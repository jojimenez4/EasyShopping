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


const dbConnection = await mysql.createConnection({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: 3306,
});



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

// Función para listar productos con paginación
async function listProducts(page) {
  const offset = (page - 1) * PAGE_SIZE;
  const [rows] = await dbConnection.query(`
    SELECT p.id, p.name, p.price, p.stock, ps.name AS size, pc.nombre_categoria AS category 
    FROM esims_product p
    JOIN esims_productsize ps ON p.medida_id_id = ps.id
    JOIN esims_productcategory pc ON p.id_categoria_id = pc.id
    WHERE p.is_active = 1
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `);
  return rows;
}

async function productsCall(userId) {
  // Inicializa la página de productos
  if (!userStates[userId].productPage) {
    userStates[userId].productPage = 1;
  }

  // Obtener productos de la base de datos para la página actual
  const rows = await listProducts(userStates[userId].productPage);

  let replyText;

  // Si hay productos disponibles
  if (rows.length > 0) {
    // Crear la lista de productos formateada
    const productList = rows
      .map((row, index) => ` ${index + 1}-  | ${row.name} | $${Number(row.price).toFixed(0)} X ${row.size}\n ↳ Stock: ${String(row.stock)}`)

      .join("\n");


    // Texto de respuesta con la lista de productos
    replyText = `Los productos disponibles son:\n${productList}\nResponde con un número de la lista o ">" para ver más productos.`;

    // Consultar los productos de la siguiente página
    const nextPageProducts = await listProducts(userStates[userId].productPage + 1);
    const buttons = [];

    if (nextPageProducts.length > 0) {
      buttons.push({
        type: "reply",
        reply: {
          id: ">",
          title: ">",
        },
      });
    }
    if (userStates[userId].productPage > 1) {
      buttons.unshift({
        type: "reply",
        reply: {
          id: "<",
          title: "<",
        },
      });
    }



    // Si no hay botones, enviar solo el mensaje de texto (sin botones)
    if (buttons.length === 0) {
      await sendMessage(replyText, userId);
      return;
    }

    // Asegurarse de que no se envíen más de 3 botones
    if (buttons.length > 3) {
      buttons.splice(3); // Limitar el número de botones a 3
    }

    // Enviar el mensaje interactivo con los botones
    await sendInteractiveMessage(userId, replyText, buttons);
  } else {
    // Si no hay productos, se envía un mensaje de error
    replyText = "No encontré productos en la base de datos.";
    await sendMessage(replyText, userId); // Solo mensaje de texto
    await inicio(userId, replyText);
    userStates[userId].inProductSelection = false;
  }
}

// Función para obtener o crear un contacto
async function getOrCreateContactId(userId) {
  let contactId;

  try {
    
    const [rows] = await dbConnection.query(
      `SELECT id FROM esims_contact WHERE \`numero_chatbot\` = ?`,  
      [userId]  
    );

    
    if (rows.length > 0) {
      contactId = rows[0].id;
    } else {
      
      const [insertResult] = await dbConnection.query(
        `INSERT INTO esims_contact (\`numero_chatbot\`, \`nombre_comprador\`) VALUES (?, ?)`,  // Insertar número y nombre
        [userId, 'prueba']  // Insertamos el número de teléfono y el nombre "prueba"
      );

      
      contactId = insertResult.insertId;
    }

    
    return contactId;
  } catch (error) {
    console.error("Error al obtener o crear el contacto:", error);
    return null;
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
    try {
      // Paso 1: Obtener el id del contacto desde la tabla esims_contact usando el numero_chatbot
      const [contact] = await dbConnection.query(
        `SELECT id FROM esims_contact WHERE numero_chatbot = ?`, // Buscar el id por el numero_chatbot
        [userId] // El userId es el numero_chatbot del usuario
      );
  
      // Verificar si se encontró la id del contacto
      if (contact.length > 0) {
        const idContacto = contact[0].id; // Obtener la id del contacto
  
        // Paso 2: Realizar la consulta a la tabla esims_sale con la id del contacto obtenida
        const [pedidos] = await dbConnection.query(
          `SELECT * FROM esims_sale WHERE id_contacto_id = ?`, // Buscar los pedidos asociados a la id del contacto
          [idContacto] // Usamos la id del contacto obtenida
        );
  
        // Verificar si hay pedidos
        if (pedidos.length > 0) {
          let replyText = "Aquí tienes tus pedidos:\n";
          pedidos.forEach(pedido => {
            // Personaliza el mensaje con la información relevante del pedido
            replyText += `Pedido ID: ${pedido.id}\nFecha: ${pedido.fecha_venta}\nEstado: ${pedido.estado_pedido}\n\n`; // Añadido salto de línea entre fecha y estado
          });
          await sendMessage(replyText, userId); // Enviar los pedidos al usuario
        } else {
          replyText = "No tienes pedidos registrados.";
          await sendMessage(replyText, userId); // Mensaje si no hay pedidos
        }
      } else {
        const errorMessage = "No se encontró la ID de tu contacto.";
        await sendMessage(errorMessage, userId); // Mensaje si no se encuentra la ID del contacto
      }
    } catch (error) {
      console.error("Error al consultar los pedidos:", error);
      const errorMessage = "Hubo un problema al obtener tus pedidos. Por favor, intenta de nuevo más tarde.";
      await sendMessage(errorMessage, userId); // Mensaje en caso de error
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
        userStates[userId].productPage = 1;

        // Mostrar opciones para continuar
        await postSelect(userId);

      }
    }
    else if (userStates[userId]?.inProductSelection && (incomingText === ">" || incomingText === "<")) {
      // Navegar a la siguiente página de productos
      if (incomingText === ">") {
        let rows = await listProducts(userStates[userId].productPage + 1);

        // Si hay productos en la siguiente página, entonces avanzamos
        if (rows.length > 0) {
          userStates[userId].productPage += 1;
        } else {
          // No hay más productos, mostrar un mensaje
          const replyText = "No hay más productos disponibles en la siguiente página.";
          await sendMessage(replyText, userId)
        };
      }
      else if (incomingText === "<" && userStates[userId].productPage > 1) {
        userStates[userId].productPage -= 1;
      }

      // Llamamos a la función `productsCall` para actualizar la lista de productos y los botones
      await productsCall(userId);
    }
    else {
      replyText = "Selección inválida. Por favor, responde con un número válido.";
      await sendMessage(replyText, userId); // Solo mensaje de texto
      await productsCall(userId);
    }

  }

  else if (userStates[userId]?.inShoppingCart) {
    if (incomingText === "Confirmar pedido") {
      if (userStates[userId].order.length === 0) {
        replyText = "No tienes productos en tu pedido.";
        await sendMessage(replyText, userId);
        await postSelect(userId);
      }

      try {
        // Validar productos en el pedido antes de confirmarlo
        let stockInsuficiente = [];
        let productosConStock = [];
        let total = 0;

        for (let i = 0; i < userStates[userId].order.length; i++) {
          const item = userStates[userId].order[i];
          const [productResult] = await dbConnection.query(
            `SELECT stock, name FROM esims_product WHERE id = ?`,
            [item.id]
          );

          if (productResult.length === 0) {
            stockInsuficiente.push(`Producto desconocido con ID ${item.id}`);
            continue;
          }

          const product = productResult[0];
          if (product.stock >= item.quantity) {
            productosConStock.push(item);
            total += item.price * item.quantity;
          } else {
            stockInsuficiente.push(`${product.name} (Stock disponible: ${product.stock})`);
            // Eliminar el producto sin stock del carrito automáticamente
            userStates[userId].order.splice(i, 1); // Elimina el producto de la orden
            i--; // Ajustar el índice después de la eliminación
          }
        }

        // Notificar si hay productos con stock insuficiente
        if (stockInsuficiente.length > 0) {
          replyText = `Los siguientes productos han sido eliminados del carrito debido a la falta de stock:\n- ${stockInsuficiente.join("\n- ")}`;
          await sendMessage(replyText, userId);
          await postSelect(userId);
        }
        else if (userStates[userId].order.length !== 0 && stockInsuficiente.length === 0) {

          // Procesar pedido solo si hay stock suficiente
          const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const contactId = await getOrCreateContactId(userId);
          userStates[userId].contactId = contactId

          // Insertar el pedido en `esims_sale`
          const [saleResult] = await dbConnection.query(
            `INSERT INTO esims_sale (fecha_venta, estado_pedido, id_contacto_id) VALUES (?, ?, ?)`,
            [currentDate, 'Confirmado', contactId]
          );

          const insertedSaleId = saleResult.insertId;

          // Insertar detalles del pedido y actualizar el stock
          for (const item of productosConStock) {
            const subtotal = item.price * item.quantity;

            // Insertar en `esims_saledetail`
            await dbConnection.query(
              `INSERT INTO esims_saledetail (id_venta_id, id_product_id, cantidad, precio_unitario, total) VALUES (?, ?, ?, ?, ?)`,
              [insertedSaleId, item.id, item.quantity, item.price, subtotal]
            );

            // Reducir el stock del producto
            await dbConnection.query(
              `UPDATE esims_product SET stock = stock - ? WHERE id = ?`,
              [item.quantity, item.id]
            );
          }

          // Confirmar pedido al usuario
          let orderSummary = "Tu pedido confirmado incluye:\n\n";
          productosConStock.forEach((item, index) => {
            const subtotal = item.price * item.quantity;
            orderSummary += `${index + 1}. ${item.name} - ${item.quantity} unidad(es) x $${item.price} = $${subtotal.toFixed(2)}\n`;
          });
          orderSummary += `\nTotal: $${total.toFixed(2)}\n¡Gracias por tu pedido!`;
          await sendMessage(orderSummary, userId);


          // Vaciar el carrito y reiniciar el estado
          userStates[userId].inShoppingCart = false;
          userStates[userId].hasGreeted = false;
          userStates[userId].order = [];
          userStates[userId].inProductSelection = false;

          console.log('Todos los productos fueron insertados con éxito');
        }
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