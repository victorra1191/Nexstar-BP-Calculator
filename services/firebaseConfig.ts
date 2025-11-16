import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// =================================================================================
// ¡ACCIÓN REQUERIDA! PEGA AQUÍ LA CONFIGURACIÓN DE TU PROYECTO DE FIREBASE
// =================================================================================
// 1. Ve a la Consola de Firebase: https://console.firebase.google.com/
// 2. Entra en los Ajustes de tu Proyecto (icono de engranaje ⚙️).
// 3. En la sección "Tus apps", selecciona tu app web (o crea una si no existe).
// 4. Busca "Configuración del SDK" y elige la opción "Config".
// 5. Copia el objeto de configuración y pégalo aquí abajo, reemplazando el objeto vacío.
//
// TU CÓDIGO DEBERÍA VERSE ASÍ:
// const firebaseConfig = {
//   apiKey: "AIzaSy... ",
//   authDomain: "tu-proyecto.firebaseapp.com",
//   projectId: "tu-proyecto",
//   storageBucket: "tu-proyecto.appspot.com",
//   messagingSenderId: "...",
//   appId: "1:..."
// };
//
// NOTE: Your keys will be injected by the environment. For local development,
// you can paste them here, but DO NOT commit them to version control.
const firebaseConfig: { [key: string]: string } = {
  // apiKey: "...",
  // authDomain: "...",
  // projectId: "...",
  // storageBucket: "...",
  // messagingSenderId: "...",
  // appId: "...",
  // measurementId: "..."
};
// =================================================================================


// Initialize Firebase
if (!firebase.apps.length) {
  // Verification to prevent initializing with an empty config
  if (!firebaseConfig.apiKey && process.env.NODE_ENV !== 'production') {
    console.error("Firebase config is missing. Please update services/firebaseConfig.ts");
    // Display a message in the UI
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `
        <div style="padding: 4rem; text-align: center; font-family: sans-serif; color: #333; background-color: #f8f9fa; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <h1 style="color: #dc3545; font-size: 2rem;">Error de Configuración de Firebase</h1>
          <p style="font-size: 1.1rem; max-width: 600px; line-height: 1.6;">La configuración de Firebase no se ha encontrado en <code>services/firebaseConfig.ts</code>.</p>
          <p style="font-size: 1.1rem; max-width: 600px; line-height: 1.6;">Por favor, sigue las instrucciones en ese archivo para añadir las credenciales de tu proyecto y poder iniciar la aplicación.</p>
        </div>
      `;
    }
  } else {
    firebase.initializeApp(firebaseConfig);
  }
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export default firebase;
