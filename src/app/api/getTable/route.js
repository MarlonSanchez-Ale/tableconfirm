import { NextResponse } from "next/server";
import { google } from "googleapis";
import { config } from "dotenv";

config(); // Cargar variables de entorno

const SHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_RANGE = "mesas!B:D"; // B: MESA ASIGNADA, C: Nombres, D: Apellidos

function normalizeString(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/\s+/g, " ") // Eliminar espacios extra
    .trim()
    .replace(/[\u0300-\u036f]/g, ""); // Eliminar tildes
}

function isValidName(name) {
  return /^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]+$/.test(name); // Permitir solo letras y espacios
}

function jaccardSimilarity(set1, set2) {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

function compareNames(inputNames, inputSurnames, rowNames, rowSurnames) {
  const inputNamesSet = new Set(inputNames.map(normalizeString));
  const inputSurnamesSet = new Set(inputSurnames.map(normalizeString));
  const rowNamesSet = new Set(rowNames.map(normalizeString));
  const rowSurnamesSet = new Set(rowSurnames.map(normalizeString));

  const nameSimilarity = jaccardSimilarity(inputNamesSet, rowNamesSet);
  const surnameSimilarity = jaccardSimilarity(inputSurnamesSet, rowSurnamesSet);

  return (nameSimilarity * 0.6) + (surnameSimilarity * 0.4); // Ponderación: más peso a nombres
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const nombres = searchParams.get("nombres");
  const apellidos = searchParams.get("apellidos");

  if (!nombres || !apellidos) {
    return NextResponse.json({ error: "Los parámetros 'nombres' y 'apellidos' son requeridos." }, { status: 400 });
  }

  if (!isValidName(nombres) || !isValidName(apellidos)) {
    return NextResponse.json({ error: "Los nombres y apellidos no deben contener números, ni caracteres especiales." }, { status: 400 });
  }

  const nombresArray = nombres.trim().split(" ").filter(Boolean);
  const apellidosArray = apellidos.trim().split(" ").filter(Boolean);

  if (nombresArray.length < 1 || apellidosArray.length < 1) {
    return NextResponse.json({ error: "Debe ingresar al menos un nombre y un apellido." }, { status: 400 });
  }

  if (!process.env.GOOGLE_CREDENTIALS) {
    console.error("Las credenciales de Google no están configuradas.");
    return NextResponse.json({ error: "Las credenciales de Google no están configuradas." }, { status: 500 });
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
      return NextResponse.json({ error: "No se encontraron datos en la hoja de cálculo." }, { status: 404 });
    }

    let bestMatch = null;
    let highestSimilarity = 0;

    for (const row of rows) {
      if (row.length >= 3) {
        const mesaAsignada = row[0];
        const nombresFila = row[1] ? row[1].split(" ").filter(Boolean) : [];
        const apellidosFila = row[2] ? row[2].split(" ").filter(Boolean) : [];

        if (nombresFila.length === 0 || apellidosFila.length === 0) continue; // Ignorar filas inválidas

        const similarity = compareNames(nombresArray, apellidosArray, nombresFila, apellidosFila);

        if (similarity > highestSimilarity && similarity >= 0.5) {
          highestSimilarity = similarity;
          bestMatch = mesaAsignada;
        }
      }
    }

    if (!bestMatch || highestSimilarity < 0.5) {
      return NextResponse.json({ error: "Nombre no encontrado en la lista." }, { status: 404 });
    }

    return NextResponse.json({ mesa: bestMatch }, { status: 200,   headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error al conectar con Google Sheets:", error);
    return NextResponse.json({ error: "Error interno del servidor al consultar los datos, intente luego." }, { status: 500 });
  }
}
