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
  seccion: 'soporte';
  titulo: Record<IdiomaDocs, string>;
  resumen: Record<IdiomaDocs, string>;
  cuerpo: Record<IdiomaDocs, Bloque[]>;
}

export const GUIAS: Guia[] = [
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
