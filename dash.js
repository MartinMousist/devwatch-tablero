// Versión mínima de la API de dashboards para publicar el tablero como sitio estático.
// Carga los JSON, corre los cálculos de calcs.js y avisa a la página cuando hay datos.
(() => {
  const calcs = {};
  const datos = {};
  const oyentes = [];
  let estado = 'loading';
  let parametros = { opcion: 'todo', semanas: 1 };
  const avisar = () => oyentes.forEach((f) => f());

  window.dash = {
    colors: ['#2b6cb0', '#d9622b', '#4a8c6f', '#8a63b8'],
    calc: (id, def) => { calcs[id] = def; },
    data: (id) => (estado === 'ok' && id in datos ? { status: 'ok', data: datos[id] } : { status: estado }),
    onData: (f) => { oyentes.push(f); if (estado !== 'loading') f(); },
    params: () => parametros,
    setParams: (p) => { parametros = { ...parametros, ...p }; avisar(); },
    setLink: (id) => history.replaceState(null, '', '#' + id),
  };

  const leer = async (archivo) => {
    const r = await fetch(archivo, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${archivo}: HTTP ${r.status}`);
    return { filas: await r.json(), fecha: r.headers.get('last-modified') };
  };

  window.addEventListener('DOMContentLoaded', async () => {
    try {
      const [cronograma, riesgos] = await Promise.all([leer('cronograma.json'), leer('riesgos.json')]);
      datos.cronograma = cronograma.filas;
      datos.riesgos = riesgos.filas;
      // Cada cálculo espera a que estén sus entradas (resumen depende de pronostico).
      const pendientes = Object.keys(calcs);
      while (pendientes.length) {
        const i = pendientes.findIndex((id) => calcs[id].inputs.every((e) => e in datos));
        if (i < 0) throw new Error(`Faltan entradas para: ${pendientes.join(', ')}`);
        const [id] = pendientes.splice(i, 1);
        datos[id] = calcs[id].fn(...calcs[id].inputs.map((e) => datos[e]));
      }
      estado = 'ok';
      const pie = document.getElementById('dw-actualizado');
      if (pie && cronograma.fecha) {
        pie.textContent = 'Última actualización del cronograma: ' + new Date(cronograma.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
      }
    } catch (err) {
      estado = 'error';
      console.error(err);
      document.getElementById('dw-actualizado').textContent = 'No se pudieron cargar los datos del cronograma.';
    }
    avisar();

    // Los gráficos se dibujan al ancho de su caja: se redibujan si ese ancho cambia.
    let ancho = document.body.clientWidth;
    new ResizeObserver(() => {
      if (document.body.clientWidth === ancho) return;
      ancho = document.body.clientWidth;
      avisar();
    }).observe(document.body);
    // Primer dibujo con el diseño ya calculado.
    requestAnimationFrame(avisar);
  });
})();
