// Docs: guías públicas, cada una en su propia página con dirección fija, en inglés y español.
// El inglés vive en /docs/<guía> y el español en /es/docs/<guía>.

export type IdiomaDocs = 'en' | 'es';

export type Bloque =
  | { tipo: 'p'; texto: string }
  | { tipo: 'h2'; texto: string }
  | { tipo: 'pasos'; items: string[] }
  | { tipo: 'lista'; items: string[] }
  | { tipo: 'imagen'; src: string; alt: string }
  | { tipo: 'nota'; texto: string };

export interface Guia {
  slug: string;
  seccion: 'empezar' | 'soporte';
  titulo: Record<IdiomaDocs, string>;
  resumen: Record<IdiomaDocs, string>;
  cuerpo: Record<IdiomaDocs, Bloque[]>;
}

export const GUIAS: Guia[] = [
  {
    slug: 'repeated-receipts-and-status-colors',
    seccion: 'empezar',
    titulo: { en: 'Repeated receipts and status colors', es: 'Capturas repetidas y colores de cada movimiento' },
    resumen: {
      en: 'How FinTwin warns you when a receipt was already used, and what each colored dot in your movements means.',
      es: 'Cómo te avisa FinTwin cuando una captura ya se usó, y qué significa cada punto de color en tus movimientos.',
    },
    cuerpo: {
      en: [
        { tipo: 'p', texto: 'A receipt can only be counted once. FinTwin compares every new receipt with all the ones already recorded: the same image or the same confirmation number means it is a repeat, even if it was sent from another phone or to another account.' },
        { tipo: 'h2', texto: 'When you record a receipt' },
        { tipo: 'pasos', items: [
          'Open your account and, in “Record receipt”, tap to upload the screenshot.',
          'The AI reads it right away: amount, confirmation number, who paid, who received and the platform.',
          'If that receipt was already used, a red “Duplicate receipt” box appears with its whole usage history.',
          'If it is already in this same account, it can’t go in twice. If it was used in another account, you can tap “Accept anyway” and confirm with your PIN.',
        ] },
        { tipo: 'imagen', src: '/docs/repetidas-aviso-en.png', alt: 'The red Duplicate receipt box with the usage history' },
        { tipo: 'nota', texto: 'Before saving, FinTwin asks “Money coming IN”: a last check so nobody records an outflow by mistake.' },
        { tipo: 'h2', texto: 'What each dot means' },
        { tipo: 'lista', items: [
          'Green with a check: approved, and the receipt was never used anywhere else.',
          'Yellow with a triangle: approved, but the same receipt was used 1 or 2 more times.',
          'Orange with a triangle: approved, and the receipt was used 3 or more times. Check it carefully.',
          'Orange with a clock: pending, waiting for approval.',
          'Red with a triangle: on hold. It was approved but doesn’t count in the total until you confirm it with your PIN.',
          'Red with an X: rejected or cancelled. It never counts in the total.',
        ] },
        { tipo: 'p', texto: 'Tap any movement to open it: you see gross, fee and net, the big confirmation number ready to copy, the data the AI detected, the receipt image and, if it was repeated, the “Repeated receipt” box with every use.' },
        { tipo: 'imagen', src: '/docs/repetidas-colores-en.png', alt: 'An open movement with its yellow dot and the Repeated receipt box' },
        { tipo: 'h2', texto: 'And from the payment link?' },
        { tipo: 'p', texto: 'Whoever pays you with your link is warned as soon as they choose the photo: “This receipt was already sent before.” It doesn’t reach you twice.' },
      ],
      es: [
        { tipo: 'p', texto: 'Una captura se cuenta una sola vez. FinTwin compara cada comprobante nuevo con todos los que ya están registrados: la misma imagen o el mismo número de confirmación es una repetida, aunque llegue desde otro teléfono o a otra cuenta.' },
        { tipo: 'h2', texto: 'Cuando registras un comprobante' },
        { tipo: 'pasos', items: [
          'Abre tu cuenta y, en «Registrar comprobante», toca para subir la captura.',
          'La IA la lee enseguida: monto, número de confirmación, quién pagó, quién recibió y la plataforma.',
          'Si esa captura ya se usó, aparece el recuadro rojo «Captura duplicada» con todo su historial de uso.',
          'Si ya está en esta misma cuenta, no puede entrar dos veces. Si se usó en otra cuenta, puedes tocar «Aceptar igual» y confirmar con tu PIN.',
        ] },
        { tipo: 'imagen', src: '/docs/repetidas-aviso-es.png', alt: 'El recuadro rojo Captura duplicada con su historial de uso' },
        { tipo: 'nota', texto: 'Antes de guardar, FinTwin pregunta «ENTRADA de dinero»: una última revisión para que nadie registre una salida por error.' },
        { tipo: 'h2', texto: 'Qué significa cada punto' },
        { tipo: 'lista', items: [
          'Verde con un check: aprobado, y la captura nunca se usó en otro lado.',
          'Amarillo con un triángulo: aprobado, pero la misma captura se usó 1 o 2 veces más.',
          'Naranja con un triángulo: aprobado, y la captura se usó 3 o más veces. Revísalo con cuidado.',
          'Naranja con un reloj: pendiente, esperando aprobación.',
          'Rojo con un triángulo: en espera. Se aprobó, pero no cuenta en el total hasta que lo confirmes con tu PIN.',
          'Rojo con una X: rechazado o cancelado. Nunca cuenta en el total.',
        ] },
        { tipo: 'p', texto: 'Toca cualquier movimiento para abrirlo: ves el bruto, la comisión y el neto, el número de confirmación en grande listo para copiar, los datos que detectó la IA, la imagen de la captura y, si se repitió, el recuadro «Captura repetida» con cada uso.' },
        { tipo: 'imagen', src: '/docs/repetidas-colores-es.png', alt: 'Un movimiento abierto con su punto amarillo y el recuadro Captura repetida' },
        { tipo: 'h2', texto: '¿Y desde el link de pago?' },
        { tipo: 'p', texto: 'A quien te paga con tu link se le avisa apenas elige la foto: «Este comprobante ya fue enviado antes». No te llega dos veces.' },
      ],
    },
  },
  {
    slug: 'team-access-codes',
    seccion: 'empezar',
    titulo: { en: 'Add your team with an access code', es: 'Agrega a tu equipo con un código de acceso' },
    resumen: {
      en: 'Give each person a code so they can upload receipts or approve them from the app, with no email or password.',
      es: 'Dale a cada persona un código para que suba capturas o las apruebe desde la app, sin correo ni contraseña.',
    },
    cuerpo: {
      en: [
        { tipo: 'p', texto: 'Only the person who manages the money needs a FinTwin account with email and password. Everyone else, the person who uploads the payment screenshots and the people who review them, enters the app with a code you give them.' },
        { tipo: 'h2', texto: 'Two kinds of access' },
        { tipo: 'lista', items: [
          'Upload receipts: the person only uploads payment screenshots to your account. They see nothing else.',
          'Review and approve: the person approves or rejects receipts with their own 4-digit PIN. They cannot record outflows or change settings.',
        ] },
        { tipo: 'h2', texto: 'Give someone access, step by step' },
        { tipo: 'pasos', items: [
          'Open your account and tap “Add people”.',
          'Tap “Add a person”, write their name and choose what they will do.',
          'Confirm with your PIN.',
          'FinTwin shows a code like ABCD-2345. Tap “Send by WhatsApp” or copy it and send it any way you like.',
        ] },
        { tipo: 'imagen', src: '/docs/acceso-agregar-en.png', alt: 'The Add a person window in FinTwin, with the name and the two kinds of access' },
        { tipo: 'imagen', src: '/docs/acceso-codigo-en.png', alt: 'The access code ready to share, and the list of people with access' },
        { tipo: 'h2', texto: 'What the other person does' },
        { tipo: 'pasos', items: [
          'Download FinTwin, or open it in the browser.',
          'Tap “I have an access code” and type the code.',
          'If they will review receipts, they create their own PIN.',
          'That’s it. Whoever uploads goes straight to the upload screen; whoever reviews goes straight to your account.',
        ] },
        { tipo: 'imagen', src: '/docs/acceso-entrar-en.png', alt: 'The FinTwin screen to enter with an access code' },
        { tipo: 'nota', texto: 'Each code works once and expires in 7 days. If the person changes phones or signs out, open the ⋮ menu next to their name and tap “Give a new code”: they come back to the same access, with their history. To take access away, tap “Remove access” in the same menu.' },
        { tipo: 'h2', texto: 'And the payment link?' },
        { tipo: 'p', texto: 'You can still share your payment link or QR with customers who pay you once. They only write their name and upload the screenshot: no account, no password.' },
      ],
      es: [
        { tipo: 'p', texto: 'Solo quien administra el dinero necesita una cuenta de FinTwin con correo y contraseña. Todos los demás, quien sube las capturas de los pagos y quienes las revisan, entran a la app con un código que tú les das.' },
        { tipo: 'h2', texto: 'Dos tipos de acceso' },
        { tipo: 'lista', items: [
          'Subir capturas: la persona solo sube las capturas de los pagos a tu cuenta. No ve nada más.',
          'Revisar y aprobar: la persona aprueba o rechaza los comprobantes con su propio PIN de 4 números. No registra salidas ni cambia ajustes.',
        ] },
        { tipo: 'h2', texto: 'Dale acceso a alguien, paso a paso' },
        { tipo: 'pasos', items: [
          'Abre tu cuenta y toca «Agregar personas».',
          'Toca «Agregar persona», escribe su nombre y elige qué va a hacer.',
          'Confirma con tu PIN.',
          'FinTwin te muestra un código como ABCD-2345. Toca «Mandar por WhatsApp» o cópialo y mándalo como quieras.',
        ] },
        { tipo: 'imagen', src: '/docs/acceso-agregar-es.png', alt: 'La ventana Agregar persona de FinTwin, con el nombre y los dos tipos de acceso' },
        { tipo: 'imagen', src: '/docs/acceso-codigo-es.png', alt: 'El código de acceso listo para mandar y la lista de personas con acceso' },
        { tipo: 'h2', texto: 'Lo que hace la otra persona' },
        { tipo: 'pasos', items: [
          'Descarga FinTwin, o lo abre en el navegador.',
          'Toca «Tengo un código de acceso» y escribe el código.',
          'Si va a revisar comprobantes, crea su propio PIN.',
          'Listo. Quien sube entra directo a la pantalla de subir; quien revisa entra directo a tu cuenta.',
        ] },
        { tipo: 'imagen', src: '/docs/acceso-entrar-es.png', alt: 'La pantalla de FinTwin para entrar con un código de acceso' },
        { tipo: 'nota', texto: 'Cada código sirve una vez y vence en 7 días. Si la persona cambia de celular o cierra sesión, abre el menú ⋮ junto a su nombre y toca «Darle un código nuevo»: vuelve al mismo acceso, con su historial. Para quitarle el acceso, toca «Quitar acceso» en el mismo menú.' },
        { tipo: 'h2', texto: '¿Y el link de pago?' },
        { tipo: 'p', texto: 'Puedes seguir compartiendo tu link de pago o tu QR con clientes que te pagan una vez. Solo escriben su nombre y suben la captura: sin cuenta y sin contraseña.' },
      ],
    },
  },
  {
    slug: 'help-cases',
    seccion: 'soporte',
    titulo: { en: 'Get help inside the app', es: 'Pide ayuda dentro de la app' },
    resumen: {
      en: 'Open a help case, attach screenshots and follow our answers like a chat, without leaving FinTwin.',
      es: 'Abre un caso de ayuda, adjunta capturas y sigue nuestras respuestas como un chat, sin salir de FinTwin.',
    },
    cuerpo: {
      en: [
        { tipo: 'p', texto: 'When something is not working as you expect, you can ask our support team for help right from FinTwin. Every request becomes a help case with its own number, and the whole conversation stays in one place.' },
        { tipo: 'h2', texto: 'What it is for' },
        { tipo: 'lista', items: ['A receipt you uploaded does not show up.', 'You cannot approve, share your payment link or invite your team.', 'You have a question about how something works.'] },
        { tipo: 'h2', texto: 'Open a case, step by step' },
        { tipo: 'pasos', items: [
          'Sign in to FinTwin and tap your name at the top right.',
          'Choose “Help and support”.',
          'Write a short subject and tell us what happened, step by step.',
          'Tap “Attach screenshots” to add up to 3 images (JPG, PNG, WebP or HEIC, 10 MB each). Screenshots help us solve it faster.',
          'Tap “Send”. You will see your case number right away.',
        ] },
        { tipo: 'imagen', src: '/docs/ayuda-en.png', alt: 'The Help screen in FinTwin with the new case form' },
        { tipo: 'h2', texto: 'Follow the answers' },
        { tipo: 'p', texto: 'Your cases are listed under “My cases”, each with its status: “Waiting for us” while we look into it, “Answered” when we replied, and “Closed” when it is solved. Tap a case to see the conversation like a chat, with your messages on the right and ours on the left.' },
        { tipo: 'imagen', src: '/docs/ayuda-caso-en.png', alt: 'A help case in FinTwin shown as a chat, with the answer from FinTwin Support' },
        { tipo: 'p', texto: 'When we answer, we let you know by email and, if you use the FinTwin app on your phone, with a notification. Tapping it opens the case.' },
        { tipo: 'h2', texto: 'Reply or reopen a case' },
        { tipo: 'p', texto: 'Write your reply at the bottom of the case and tap “Send”. You can attach new screenshots too. If the case was closed, writing again reopens it.' },
        { tipo: 'nota', texto: 'What you type is saved on your device while you write. If the app closes or you lose your connection, your message is still there when you come back. Screenshots must be chosen again.' },
        { tipo: 'h2', texto: 'Other ways to reach us' },
        { tipo: 'p', texto: 'You can also write to soporte+fintwin@windoce.com. For your safety, never send us your password or your PIN: our team will never ask for them.' },
      ],
      es: [
        { tipo: 'p', texto: 'Cuando algo no funciona como esperas, puedes pedirle ayuda a nuestro equipo de soporte desde el mismo FinTwin. Cada pedido se convierte en un caso de ayuda con su propio número, y toda la conversación queda en un solo lugar.' },
        { tipo: 'h2', texto: 'Para qué sirve' },
        { tipo: 'lista', items: ['Un comprobante que subiste no aparece.', 'No puedes aprobar, compartir tu link de pago o invitar a tu equipo.', 'Tienes una duda sobre cómo funciona algo.'] },
        { tipo: 'h2', texto: 'Abre un caso, paso a paso' },
        { tipo: 'pasos', items: [
          'Entra a FinTwin y toca tu nombre, arriba a la derecha.',
          'Elige «Ayuda y soporte».',
          'Escribe un asunto corto y cuéntanos qué pasó, paso a paso.',
          'Toca «Adjuntar capturas» para agregar hasta 3 imágenes (JPG, PNG, WebP o HEIC, de 10 MB cada una). Las capturas nos ayudan a resolverlo más rápido.',
          'Toca «Enviar». En ese momento ves el número de tu caso.',
        ] },
        { tipo: 'imagen', src: '/docs/ayuda-es.png', alt: 'La pantalla Ayuda de FinTwin con el formulario de caso nuevo' },
        { tipo: 'h2', texto: 'Sigue las respuestas' },
        { tipo: 'p', texto: 'Tus casos aparecen en «Mis casos», cada uno con su estado: «Esperando respuesta» mientras lo revisamos, «Respondido» cuando te contestamos y «Cerrado» cuando quedó resuelto. Toca un caso para ver la conversación como un chat, con tus mensajes a la derecha y los nuestros a la izquierda.' },
        { tipo: 'imagen', src: '/docs/ayuda-caso-es.png', alt: 'Un caso de ayuda en FinTwin como un chat, con la respuesta de Soporte FinTwin' },
        { tipo: 'p', texto: 'Cuando te respondemos, te avisamos por correo y, si usas la app de FinTwin en tu celular, con una notificación. Al tocarla se abre el caso.' },
        { tipo: 'h2', texto: 'Responde o vuelve a abrir un caso' },
        { tipo: 'p', texto: 'Escribe tu respuesta al final del caso y toca «Enviar». También puedes adjuntar capturas nuevas. Si el caso estaba cerrado, al escribir otra vez se abre de nuevo.' },
        { tipo: 'nota', texto: 'Lo que escribes se guarda en tu equipo mientras escribes. Si la app se cierra o se te va el internet, tu mensaje sigue ahí cuando vuelves. Las capturas hay que elegirlas otra vez.' },
        { tipo: 'h2', texto: 'Otras formas de escribirnos' },
        { tipo: 'p', texto: 'También puedes escribir a soporte+fintwin@windoce.com. Por tu seguridad, nunca nos mandes tu contraseña ni tu PIN: nuestro equipo jamás te los va a pedir.' },
      ],
    },
  },
  {
    slug: 'sign-in-security-check',
    seccion: 'soporte',
    titulo: { en: 'The security check when you sign in', es: 'La verificación de seguridad al entrar' },
    resumen: {
      en: 'Why FinTwin shows a small security check when you sign in or create an account, and what to do if it does not pass.',
      es: 'Por qué FinTwin muestra una pequeña verificación de seguridad al entrar o crear tu cuenta, y qué hacer si no pasa.',
    },
    cuerpo: {
      en: [
        { tipo: 'p', texto: 'FinTwin keeps a record of your income, so we protect the door. When you sign in, create an account or ask to reset your password, a small security check confirms that a real person is on the other side and not a robot trying thousands of passwords.' },
        { tipo: 'h2', texto: 'What you will see' },
        { tipo: 'pasos', items: [
          'Open the sign-in or create account screen.',
          'Below the form you will see a small box from Cloudflare, the security company that protects FinTwin.',
          'Most of the time it checks you on its own in a second and shows “Success!”. You don’t have to pick pictures or type letters.',
          'Once it shows the check mark, type your email and password and tap the button as usual.',
        ] },
        { tipo: 'imagen', src: '/docs/seguridad-entrar-en.png', alt: 'The FinTwin sign-in screen with the security check below the form' },
        { tipo: 'nota', texto: 'Sometimes, if something looks unusual, the box asks you to tick a checkbox. Just tap it and continue.' },
        { tipo: 'h2', texto: 'Why it matters to you' },
        { tipo: 'lista', items: [
          'It stops robots that try to guess passwords, so nobody gets into your account by brute force.',
          'It stops fake accounts from being created with your email.',
          'It protects the password reset, so nobody can flood your inbox with reset emails.',
        ] },
        { tipo: 'h2', texto: 'If the check does not pass' },
        { tipo: 'p', texto: 'If you see the message “Complete the security check and try again”, wait for the box to show its check mark and tap the button again. If the box does not appear at all:' },
        { tipo: 'lista', items: [
          'Reload the page.',
          'Check your internet connection.',
          'Turn off ad blockers or privacy extensions for FinTwin, because some of them hide the box.',
          'Try another browser, or the FinTwin app on your phone.',
        ] },
        { tipo: 'imagen', src: '/docs/seguridad-registro-en.png', alt: 'The FinTwin create account screen with the security check' },
        { tipo: 'p', texto: 'If it still fails, write to soporte+fintwin@windoce.com and tell us which browser or phone you use. Never send us your password: our team will never ask for it.' },
      ],
      es: [
        { tipo: 'p', texto: 'FinTwin guarda el registro de tus ingresos, por eso cuidamos la puerta. Cuando entras, creas una cuenta o pides recuperar tu contraseña, una pequeña verificación de seguridad confirma que del otro lado hay una persona y no un robot probando miles de contraseñas.' },
        { tipo: 'h2', texto: 'Qué vas a ver' },
        { tipo: 'pasos', items: [
          'Abre la pantalla de entrar o la de crear cuenta.',
          'Debajo del formulario verás un recuadro pequeño de Cloudflare, la empresa de seguridad que protege a FinTwin.',
          'Casi siempre te verifica solo en un segundo y muestra «¡Listo!». No tienes que elegir fotos ni escribir letras.',
          'Cuando aparezca la marca de verificación, escribe tu correo y tu contraseña y toca el botón como siempre.',
        ] },
        { tipo: 'imagen', src: '/docs/seguridad-entrar-es.png', alt: 'La pantalla de entrar de FinTwin con la verificación de seguridad debajo del formulario' },
        { tipo: 'nota', texto: 'A veces, si algo se ve raro, el recuadro te pide marcar una casilla. Solo tócala y sigue.' },
        { tipo: 'h2', texto: 'Por qué te conviene' },
        { tipo: 'lista', items: [
          'Frena a los robots que intentan adivinar contraseñas, así nadie entra a tu cuenta a la fuerza.',
          'Evita que creen cuentas falsas con tu correo.',
          'Protege la recuperación de contraseña, para que nadie te llene el correo de mensajes.',
        ] },
        { tipo: 'h2', texto: 'Si la verificación no pasa' },
        { tipo: 'p', texto: 'Si ves el mensaje «Completa la verificación de seguridad e inténtalo otra vez», espera a que el recuadro muestre su marca y toca el botón de nuevo. Si el recuadro no aparece:' },
        { tipo: 'lista', items: [
          'Vuelve a cargar la página.',
          'Revisa tu conexión a internet.',
          'Apaga los bloqueadores de anuncios o extensiones de privacidad para FinTwin, porque algunos esconden el recuadro.',
          'Prueba con otro navegador, o con la app de FinTwin en tu celular.',
        ] },
        { tipo: 'imagen', src: '/docs/seguridad-registro-es.png', alt: 'La pantalla de crear cuenta de FinTwin con la verificación de seguridad' },
        { tipo: 'p', texto: 'Si sigue fallando, escríbenos a soporte+fintwin@windoce.com y cuéntanos qué navegador o celular usas. Nunca nos mandes tu contraseña: nuestro equipo jamás te la va a pedir.' },
      ],
    },
  },
];

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Filtra las guías por título, resumen y texto, sin importar mayúsculas ni acentos. */
export function buscarGuias(consulta: string, idioma: IdiomaDocs, guias: Guia[] = GUIAS): Guia[] {
  const palabras = sinAcentos(consulta).split(/\s+/).filter(Boolean);
  if (!palabras.length) return guias;
  return guias.filter((g) => {
    const texto = sinAcentos(
      [g.titulo[idioma], g.resumen[idioma], ...g.cuerpo[idioma].map((b) => ('texto' in b ? b.texto : 'items' in b ? b.items.join(' ') : b.alt))].join(' '),
    );
    return palabras.every((p) => texto.includes(p));
  });
}

export function rutaDocs(idioma: IdiomaDocs, slug?: string): string {
  return `${idioma === 'es' ? '/es' : ''}/docs${slug ? `/${slug}` : ''}`;
}
