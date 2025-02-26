"use client"
import Image from "next/image";
import { useState } from 'react';

export default function Home() {
  const [nombre, setNombre] = useState("");
  const [mesa, setMesa] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMesa(null);
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/getTable?nombre=${encodeURIComponent(nombre)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (response.ok) {
        setMesa(data.mesa);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.log('Error al enviar los datos: ', error);
      setError("Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-lg w-full text-center relative overflow-hidden flex flex-col items-center">
        <div className="relative h-36 w-full rounded-t-2xl overflow-hidden">
          <Image
            src="/images/areta.jpg"
            alt="Pattern"
            layout="fill"
            objectFit="cover"
            priority
          />
        </div>
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2">
          <Image
            src="/images/foto_perfil.jpg"
            alt="Couple"
            width={192}
            height={192}
            className="rounded-full border-4 border-white object-cover"
            priority
          />
        </div>
        <div className='p-10 flex flex-col justify-center md:mt-28 sm:mt-20 gap-3 text-center'>
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold" style={{ color: "#6c8850" }}>Distribución de mesas</h1>
            <p className="text-gray-600 text-lg">Ingresá tu nombre para obtener tu número de mesa</p>
          </div>
          {mesa && <p className="my-2 text-amber-600 text-xl" style={{ color: '#af7b50'}}>Tu mesa asignada es: {mesa}</p>}
          {error && <p className="mt-4 text-red-500">{error}</p>}
          <form onSubmit={handleSubmit} className='flex flex-col gap-2 w-full'>
            <input
              type="text"
              placeholder="Nombre completo"
              className="mt-4 w-full px-4 py-2 border rounded-lg shadow-md text-brown-700"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
        
            <div className='flex flex-col justify-center w-full'>
              <button
                type="submit"
                className="mt-4 w-full text-white py-2 rounded-lg shadow-md"
                style={{ backgroundColor: "#af7b50" }}
                disabled={loading}
              >
                {loading ? 'Cargando...' : 'Aceptar'}
              </button>
              <a
                href="https://infobodasd.webflow.io"
                className="mt-4 w-full text-yellow-950 py-2 rounded-lg text-center shadow-md"

                style={{ backgroundColor: "#fff5eb", color: "#af7b50", display: "block", padding: "10px", textDecoration: "none" }}
              >
                Cancelar
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
