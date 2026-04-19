import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, useAppState } from '../contexts';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const LocationMarker = ({ position, setPosition }) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
};

const CreateListing = () => {
  const { t, lang } = useI18n();
  const { listings, setListings, companyProfile } = useAppState();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: 'Marketingový stážista',
    type: 'internship',
    workModel: 'Hybrid',
    location: 'Bratislava',
    duration: '3 months',
    startDate: new Date().toISOString().split('T')[0],
    rate: '8,00',
    rateUnit: '/hod',
    hours: '20 hod/týždenne',
    description: '',
    requirements: '',
    lat: 48.1486,
    lng: 17.1077
  });

  const setCoords = async (latlng) => {
    setFormData(prev => ({ ...prev, lat: latlng.lat, lng: latlng.lng }));
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18&addressdetails=1`);
      const data = await response.json();
      if (data && data.address) {
        const city = data.address.city || data.address.town || data.address.village || '';
        const street = data.address.road || '';
        const displayLoc = street ? `${street}, ${city}` : city;
        setFormData(prev => ({ ...prev, location: displayLoc }));
      }
    } catch (err) { console.error(err); }
  };

  const handleSave = async () => {
    const newItem = {
      ...formData,
      company: companyProfile?.name || 'Compx',
      tags: [formData.type, formData.workModel, 'Nástup: ' + formData.startDate],
      rate: formData.rate + '€',
      logo: 'CX',
      color: '#FF5C00'
    };

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      const data = await res.json();
      if (data.success) {
        setListings(prev => [{ ...newItem, id: data.id, match: 95 }, ...prev]);
        navigate('/listings');
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ animation: 'tabSlideIn 0.4s ease' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '800' }}>{t('newListing')}</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Vytvorte profesionálnu pracovnú ponuku pre študentov</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '32px', alignItems: 'start' }}>
        {/* Form Side */}
        <div style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{t('aiPos')}</label>
              <input className="text-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{t('aiType')}</label>
              <select className="text-input" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="internship">Stáž</option>
                <option value="part-time">Brigáda</option>
                <option value="full-time">Plný úväzok</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Pracovný model</label>
              <select className="text-input" value={formData.workModel} onChange={e => setFormData({...formData, workModel: e.target.value})}>
                <option value="On-site">Na pracovisku</option>
                <option value="Hybrid">Hybridne</option>
                <option value="Remote">Remote</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Trvanie</label>
              <select className="text-input" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})}>
                <option value="1 week">1 týždeň</option>
                <option value="1 month">1 mesiac</option>
                <option value="3 months">3 mesiace</option>
                <option value="6 months">6 mesiacov</option>
                <option value="Long-term">Dlhodobo</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Dátum nástupu</label>
              <input type="date" className="text-input" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Hodinová mzda (€)</label>
              <input className="text-input" type="number" value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Časový rozsah</label>
              <select className="text-input" value={formData.hours} onChange={e => setFormData({...formData, hours: e.target.value})}>
                <option value="10 hod/týždenne">10 hod/týždenne</option>
                <option value="20 hod/týždenne">20 hod/týždenne</option>
                <option value="30 hod/týždenne">30 hod/týždenne</option>
                <option value="40 hod/týždenne">40 hod/týždenne</option>
                <option value="Flexibilne / Dohodou">Flexibilne / Dohodou</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Detailný popis pozície</label>
            <textarea 
              className="text-input" 
              style={{ minHeight: '120px', resize: 'vertical', lineHeight: '1.6' }} 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Opíšte náplň práce a čo kandidát získa..."
            />
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Požiadavky na kandidáta</label>
            <textarea 
              className="text-input" 
              style={{ minHeight: '100px', resize: 'vertical', lineHeight: '1.6' }} 
              value={formData.requirements} 
              onChange={e => setFormData({...formData, requirements: e.target.value})}
              placeholder="Skúsenosti, vlastnosti, zručnosti..."
            />
          </div>

          <button className="btn-main" onClick={handleSave} style={{ height: '52px', fontSize: '16px' }}>Publikovať ponuku</button>
        </div>

        {/* Info/Map Side */}
        <div style={{ position: 'sticky', top: '24px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>{t('aiLoc')}</label>
            <input className="text-input" value={formData.location} readOnly style={{ marginBottom: '16px', opacity: 0.8 }} />
            
            <div style={{ height: '260px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <MapContainer center={[formData.lat, formData.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; OSM" />
                <LocationMarker position={{ lat: formData.lat, lng: formData.lng }} setPosition={setCoords} />
              </MapContainer>
            </div>
          </div>
          
          <div style={{ padding: '0 12px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <p>💡 Tip: Vyplnenie všetkých polí zvyšuje vaše AI skóre párovania a priláka relevantnejších kandidátov.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateListing;
