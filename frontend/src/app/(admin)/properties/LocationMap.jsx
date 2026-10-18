import { useEffect, useMemo, useState } from 'react';
import { Button, FormControl, InputGroup } from 'react-bootstrap';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [25.2048, 55.2708];

const MapInteraction = ({ position, hasPoint, onChange }) => {
  const map = useMap();

  useMapEvents({
    click(event) {
      onChange(String(event.latlng.lat), String(event.latlng.lng));
    }
  });

  useEffect(() => {
    if (hasPoint) map.setView(position, 16);
  }, [hasPoint, map, position]);

  return hasPoint ? <CircleMarker center={position} radius={8} pathOptions={{
    color: '#ffffff',
    fillColor: '#0d6efd',
    fillOpacity: 1,
    weight: 3
  }} /> : null;
};

const LocationMap = ({ lat, lng, onChange }) => {
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const latNumber = Number(lat);
  const lngNumber = Number(lng);
  const hasPoint = lat !== '' && lng !== '' && Number.isFinite(latNumber) && Number.isFinite(lngNumber);
  const position = useMemo(() => hasPoint ? [latNumber, lngNumber] : DEFAULT_CENTER, [hasPoint, latNumber, lngNumber]);

  const handleSearch = async event => {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;

    setSearching(true);
    setSearchError('');
    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        q: query,
        limit: '1'
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      if (!response.ok) throw new Error('Address search failed.');
      const results = await response.json();
      if (!Array.isArray(results) || !results.length) {
        setSearchError('Address not found.');
        return;
      }
      onChange(String(results[0].lat), String(results[0].lon));
    } catch {
      setSearchError('Unable to search for that address.');
    } finally {
      setSearching(false);
    }
  };

  return <>
      <form onSubmit={handleSearch}>
        <InputGroup className="mb-2">
          <FormControl value={search} onChange={event => setSearch(event.target.value)} placeholder="Search an address" autoComplete="off" />
          <Button type="submit" disabled={searching || !search.trim()}>
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </InputGroup>
      </form>
      {searchError && <div className="text-danger small mb-2">{searchError}</div>}
      <MapContainer center={position} zoom={hasPoint ? 16 : 11} scrollWheelZoom style={{
        width: '100%',
        height: '360px',
        borderRadius: '0.25rem'
      }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapInteraction position={position} hasPoint={hasPoint} onChange={onChange} />
      </MapContainer>
    </>;
};

export default LocationMap;
