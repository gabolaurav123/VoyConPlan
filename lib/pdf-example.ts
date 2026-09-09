/** Public, non-personal sample. Every price and schedule is explicitly an editable DEMO. */
export function createPdfExample(length = 3) {
  const days = Math.max(1, Math.min(30, Math.round(Number.isFinite(length) ? length : 3)));
  const dateAt = (offset: number) => {
    const value = new Date('2026-11-09T12:00:00Z');
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const destination = {
    id: 'cartagena', name: 'Cartagena', country: 'Colombia',
    lat: 10.391, lon: -75.479, timezone: 'America/Bogota',
    image: '/images/cartagena.jpg', author: 'Ricky Beron',
    source: 'https://unsplash.com/photos/acH94SHbWS4',
  };
  const item = (day: number, order: number, time: string, title: string, duration: number, category: string, cost: number, notes = '') => ({
    id: `example-${day}-${order}`, time, title, duration, category, cost, notes, done: false,
  });
  const itinerary = Array.from({ length: days }, (_, day) => ({
    date: dateAt(day),
    items: day === 0 ? [
      item(day, 0, '15:00', 'Llegar, instalarse y bajar el ritmo', 90, 'Llegada y descanso', 0,
        'Deja la primera tarde libre para descansar y pasear cerca del alojamiento.'),
      item(day, 1, '17:00', 'Un primer paseo por el centro histórico', 75, 'Paseo', 12,
        'Balcones de colores, calles tranquilas y una pausa para tomar algo fresco.'),
    ] : day === days - 1 ? [
      item(day, 0, '09:00', 'Desayuno sin prisa y un último paseo', 75, 'Gastronomía', 22,
        'Repite tu rincón favorito y disfruta de una última mañana sin prisa.'),
      item(day, 1, '12:00', 'Preparar el regreso', 90, 'Traslado', 18,
        'Revisa el equipaje y deja un margen cómodo para llegar al aeropuerto.'),
    ] : [
      item(day, 0, '09:00', day % 2 ? 'Descubrir la ciudad con ojos nuevos' : 'Una mañana para explorar y fotografiar', 120, 'Cultura y paseo', 28,
        'Elige un museo o una ruta por el centro y detente donde algo te sorprenda.'),
      item(day, 1, '12:30', 'Sabores locales y una pausa a la sombra', 75, 'Gastronomía', 32,
        'Busca una mesa a la sombra y prueba un plato local que te apetezca.'),
      item(day, 2, '16:30', day % 2 ? 'Cerrar el día cerca del mar' : 'Tiempo libre para tu descubrimiento favorito', 90, 'Tiempo libre', 15,
        'Reserva este rato para improvisar, conversar y disfrutar de la brisa.'),
    ],
  }));
  return {
    destination,
    trip: {
      title: days <= 3 ? 'Cartagena, a nuestro ritmo' : 'Cartagena: días para descubrir y disfrutar',
      destinationId: destination.id,
      search: { origin: 'La Paz, Bolivia', budget: days <= 3 ? 1500 : 3600, currency: 'USD', travelers: 2, days, date: dateAt(0), type: 'En pareja', perPerson: false },
      preferences: { pace: 'Relajado', accommodation: 'Hotel', occasion: 'Escapada' },
      status: 'Planificando', provenance: 'demo', createdAt: '2026-09-09T12:00:00Z',
      planned: [580, (days - 1) * 45, days * 38, days * 14, days * 30, 0, days * 8, 36, 100],
      expenses: [], itinerary,
      flight: {}, hotel: {},
      checklist: [
        { id: 'check-1', title: 'Definir presupuesto y fechas', done: true },
        { id: 'check-2', title: 'Guardar las ideas que nos gustan', done: true },
        { id: 'check-3', title: 'Verificar entrada y tránsito en fuentes oficiales', done: false },
        { id: 'check-4', title: 'Confirmar vuelos, equipaje y traslados', done: false },
        { id: 'check-5', title: 'Reservar alojamiento y comprobar check-in', done: false },
        { id: 'check-6', title: 'Revisar seguro y documentos de viaje', done: false },
        { id: 'check-7', title: 'Preparar equipaje y cargadores', done: false },
      ],
    },
  };
}
