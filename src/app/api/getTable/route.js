import { NextResponse } from "next/server";
import { google } from "googleapis";
import { config } from "dotenv";

config(); // Cargar variables de entorno

// ACCESOS A GOOGLE SHEETS
const SHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_RANGE = "mesas!B:C"; // A: Nombres, B: Número de mesa

/**
 * Normaliza una cadena eliminando tildes y convirtiendo a minúsculas.
 */
function normalizeString(str) {
  if (typeof str !== "string") return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Calcula la similitud entre dos cadenas usando el índice de Jaccard.
 */
function jaccardSimilarity(str1, str2) {
  const set1 = new Set(normalizeString(str1).split(" "));
  const set2 = new Set(normalizeString(str2).split(" "));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const nombre = searchParams.get("nombre");

  if (!nombre) {
    return NextResponse.json(
      { error: "El parámetro 'nombre' es requerido." },
      { status: 400 }
    );
  }

  // Validar que el nombre contenga al menos un nombre y un apellido
  const nombreParts = nombre.trim().split(" ");
  if (nombreParts.length < 2) {
    return NextResponse.json(
      { error: "Debe ingresar al menos un nombre y un apellido." },
      { status: 400 }
    );
  }

  if (!process.env.GOOGLE_CREDENTIALS) {
    console.error("Las credenciales de Google no están configuradas.");
    return NextResponse.json(
      { error: "Error de configuración en el servidor." },
      { status: 500 }
    );
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
    });
    
    const rows = response.data.values || [];

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron datos en la hoja de cálculo." },
        { status: 404 }
      );
    }

    let bestMatch = null;
    let highestSimilarity = 0;
    const normalizedInput = normalizeString(nombre);
    const [inputFirstName, ...inputLastNames] = nombreParts;

    for (const row of rows) {
      if (row.length >= 2) {
        const normalizedRow = normalizeString(row[1]);
        const [rowFirstName, ...rowLastNames] = normalizedRow.split(" ");
        
        // Compara si el primer nombre y primer apellido coinciden
        if (
          normalizedRow.includes(normalizeString(inputFirstName)) &&
          normalizedRow.includes(normalizeString(inputLastNames[0])) // Primer apellido
        ) {
          // Si coinciden parcialmente, aumenta la similitud solo si la coincidencia es fuerte
          const similarity = jaccardSimilarity(normalizedInput, normalizedRow);
          
          if (similarity > highestSimilarity && similarity >= 0.5) {
            highestSimilarity = similarity;
            bestMatch = row;
          }
        }
      }
    }

    // Si no hay coincidencia con alta similitud
    if (!bestMatch || highestSimilarity < 0.5) {
      return NextResponse.json(
        { error: "Nombre no encontrado en la lista." },
        { status: 404 }
      );
    }

    return NextResponse.json({ mesa: bestMatch[0] }, { status: 200 });
  } catch (error) {
    console.error("Error al conectar con Google Sheets:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al consultar los datos." },
      { status: 500 }
    );
  }
}
