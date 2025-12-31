import { useState, useEffect } from 'react'

// Constantes
const MAX_HOUSES = 4
const MAX_HOTELS = 1

// Utilitaire pour générer des IDs
const genId = () => Math.random().toString(36).substr(2, 9)

// Validation du loyer
const isValidRent = (rentValue) => {
  if (!rentValue || !rentValue.trim()) return false
  const parsed = parseInt(rentValue)
  return !isNaN(parsed) && parsed > 0
}

// Hook pour localStorage
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : initialValue
  })
  
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  
  return [value, setValue]
}

// Composant Modal
function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// Composant principal
export default function App() {
  const [players, setPlayers] = useLocalStorage('monopoly-players', [])
  const [properties, setProperties] = useLocalStorage('monopoly-properties', [])
  const [history, setHistory] = useLocalStorage('monopoly-history', [])
  
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPropertyName, setNewPropertyName] = useState('')
  const [newPropertyRent, setNewPropertyRent] = useState('')
  
  const [shareModal, setShareModal] = useState({ open: false, propertyId: null })
  const [shares, setShares] = useState({})
  
  const [rentModal, setRentModal] = useState({ open: false, propertyId: null, payerId: null })
  const [editRentModal, setEditRentModal] = useState({ open: false, propertyId: null, newRent: '' })

  // Ajouter un joueur
  const addPlayer = () => {
    if (!newPlayerName.trim()) return
    setPlayers([...players, { id: genId(), name: newPlayerName.trim(), balance: 0 }])
    setNewPlayerName('')
  }

  // Supprimer un joueur
  const removePlayer = (id) => {
    setPlayers(players.filter(p => p.id !== id))
    // Retirer aussi des propriétés
    setProperties(properties.map(prop => ({
      ...prop,
      owners: prop.owners.filter(o => o.playerId !== id)
    })))
  }

  // Modifier le solde d'un joueur
  const adjustBalance = (playerId, amount) => {
    setPlayers(players.map(p => 
      p.id === playerId ? { ...p, balance: p.balance + amount } : p
    ))
  }

  // Ajouter une propriété
  const addProperty = () => {
    if (!newPropertyName.trim() || !newPropertyRent) return
    setProperties([...properties, {
      id: genId(),
      name: newPropertyName.trim(),
      rent: parseInt(newPropertyRent),
      owners: [],
      houses: 0,
      hotels: 0
    }])
    setNewPropertyName('')
    setNewPropertyRent('')
  }

  // Supprimer une propriété
  const removeProperty = (id) => {
    setProperties(properties.filter(p => p.id !== id))
  }

  // Ouvrir modal de partage
  const openShareModal = (propertyId) => {
    const property = properties.find(p => p.id === propertyId)
    const initialShares = {}
    players.forEach(p => {
      const existing = property.owners.find(o => o.playerId === p.id)
      initialShares[p.id] = existing ? existing.share : 0
    })
    setShares(initialShares)
    setShareModal({ open: true, propertyId })
  }

  // Sauvegarder les parts
  const saveShares = () => {
    const propertyId = shareModal.propertyId
    const newOwners = Object.entries(shares)
      .filter(([, share]) => share > 0)
      .map(([playerId, share]) => ({ playerId, share: parseInt(share) }))
    
    setProperties(properties.map(p => 
      p.id === propertyId ? { ...p, owners: newOwners } : p
    ))
    setShareModal({ open: false, propertyId: null })
  }

  const totalShares = Object.values(shares).reduce((a, b) => a + parseInt(b || 0), 0)

  // Collecter le loyer
  const collectRent = () => {
    const { propertyId, payerId } = rentModal
    const property = properties.find(p => p.id === propertyId)
    const payer = players.find(p => p.id === payerId)
    
    if (!property || !payer || property.owners.length === 0) return

    const rent = property.rent
    let newPlayers = [...players]
    
    // Déduire du payeur
    newPlayers = newPlayers.map(p => 
      p.id === payerId ? { ...p, balance: p.balance - rent } : p
    )
    
    // Distribuer aux propriétaires
    const distributions = []
    property.owners.forEach(owner => {
      const amount = Math.floor(rent * owner.share / 100)
      const ownerPlayer = players.find(p => p.id === owner.playerId)
      newPlayers = newPlayers.map(p => 
        p.id === owner.playerId ? { ...p, balance: p.balance + amount } : p
      )
      distributions.push(`${ownerPlayer.name}: +${amount}K`)
    })
    
    setPlayers(newPlayers)
    
    // Ajouter à l'historique
    const historyEntry = {
      id: genId(),
      time: new Date().toLocaleTimeString(),
      text: `${payer.name} paye ${rent}K sur ${property.name} → ${distributions.join(', ')}`
    }
    setHistory([historyEntry, ...history.slice(0, 19)])
    
    setRentModal({ open: false, propertyId: null, payerId: null })
  }

  // Ouvrir modal de modification de loyer
  const openEditRentModal = (propertyId) => {
    const property = properties.find(p => p.id === propertyId)
    setEditRentModal({ open: true, propertyId, newRent: property.rent.toString() })
  }

  // Sauvegarder le nouveau loyer
  const saveRent = () => {
    const { propertyId, newRent } = editRentModal
    if (!isValidRent(newRent)) return
    
    setProperties(properties.map(p => 
      p.id === propertyId ? { ...p, rent: parseInt(newRent) } : p
    ))
    setEditRentModal({ open: false, propertyId: null, newRent: '' })
  }

  // Modifier le nombre de maisons
  const updateHouses = (propertyId, delta) => {
    setProperties(properties.map(p => {
      if (p.id === propertyId) {
        const newHouses = Math.max(0, Math.min(MAX_HOUSES, (p.houses || 0) + delta))
        return { ...p, houses: newHouses }
      }
      return p
    }))
  }

  // Modifier le nombre d'hôtels
  const updateHotels = (propertyId, delta) => {
    setProperties(properties.map(p => {
      if (p.id === propertyId) {
        const newHotels = Math.max(0, Math.min(MAX_HOTELS, (p.hotels || 0) + delta))
        return { ...p, hotels: newHotels }
      }
      return p
    }))
  }

  // Reset tout
  const resetAll = () => {
    if (confirm('Voulez-vous vraiment tout réinitialiser ?')) {
      setPlayers([])
      setProperties([])
      setHistory([])
    }
  }

  return (
    <>
      <div className="app-layout">
        {/* Fixed Left Sidebar */}
        <div className="sidebar sidebar-left">
          <h1>🎩 Monopoly Hub</h1>
          
          {/* Joueurs dans la sidebar */}
          <div className="sidebar-section">
            <h2>👥 Joueurs</h2>
            <div className="input-row">
              <input
                className="input"
                placeholder="Nom du joueur"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && addPlayer()}
              />
              <button className="btn" onClick={addPlayer}>+</button>
            </div>
            
            <div className="players-list">
              {players.map(player => (
                <div key={player.id} className="player-item">
                  <div className="player-info">
                    <span className="player-name">{player.name}</span>
                    <span className={`player-balance ${player.balance < 0 ? 'negative' : ''}`}>
                      {player.balance}K
                    </span>
                  </div>
                  <div className="player-actions">
                    <button className="btn btn-small" onClick={() => adjustBalance(player.id, -10)}>-10</button>
                    <button className="btn btn-small btn-success" onClick={() => adjustBalance(player.id, 10)}>+10</button>
                    <button className="btn btn-small btn-danger" onClick={() => removePlayer(player.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Résumé des propriétés dans la sidebar */}
          <div className="sidebar-section">
            <h2>🏠 Propriétés ({properties.length})</h2>
            <div className="properties-summary">
              {properties.length === 0 ? (
                <p className="empty-state">Aucune propriété</p>
              ) : (
                properties.map(property => (
                  <div key={property.id} className="property-summary-item">
                    <div className="property-summary-header">
                      <span className="property-name">{property.name}</span>
                      <span className="property-rent">{property.rent}K</span>
                    </div>
                    {property.owners.length > 0 && (
                      <div className="owners-summary">
                        {property.owners.map(owner => {
                          const player = players.find(p => p.id === owner.playerId)
                          return player ? (
                            <span key={owner.playerId} className="owner-badge-small">
                              {player.name}: {owner.share}%
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="main-content">
          <div className="content-header">
            <h2>🏠 Gestion des Propriétés</h2>
            <button className="btn btn-danger" onClick={resetAll}>
              🗑️ Réinitialiser tout
            </button>
          </div>

          <div className="card">
            <h3>Ajouter une propriété</h3>
            <div className="input-row">
              <input
                className="input"
                placeholder="Nom de la propriété"
                value={newPropertyName}
                onChange={e => setNewPropertyName(e.target.value)}
              />
              <input
                className="input"
                type="number"
                placeholder="Loyer"
                value={newPropertyRent}
                onChange={e => setNewPropertyRent(e.target.value)}
                style={{ width: '150px' }}
              />
              <button className="btn" onClick={addProperty}>+ Ajouter</button>
            </div>
          </div>

          <div className="properties-grid">
            {properties.map(property => (
              <div key={property.id} className="property-card">
                <div className="property-card-header">
                  <div className="property-info">
                    <div className="property-name">{property.name}</div>
                    <div className="property-rent">
                      Loyer: {property.rent}K
                      <button 
                        className="btn btn-tiny" 
                        onClick={() => openEditRentModal(property.id)}
                        title="Modifier le loyer"
                      >
                        ✏️
                      </button>
                    </div>
                  </div>
                  <button className="btn btn-small btn-danger" onClick={() => removeProperty(property.id)}>✕</button>
                </div>
                
                {/* Houses and Hotels Section */}
                <div className="property-buildings">
                  <div className="building-control">
                    <span className="building-label">🏠 Maisons:</span>
                    <div className="building-buttons">
                      <button 
                        className="btn btn-tiny" 
                        onClick={() => updateHouses(property.id, -1)}
                        disabled={(property.houses || 0) === 0}
                      >
                        -
                      </button>
                      <span className="building-count">{property.houses || 0}</span>
                      <button 
                        className="btn btn-tiny" 
                        onClick={() => updateHouses(property.id, 1)}
                        disabled={(property.houses || 0) === MAX_HOUSES}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="building-control">
                    <span className="building-label">🏨 Hôtels:</span>
                    <div className="building-buttons">
                      <button 
                        className="btn btn-tiny" 
                        onClick={() => updateHotels(property.id, -1)}
                        disabled={(property.hotels || 0) === 0}
                      >
                        -
                      </button>
                      <span className="building-count">{property.hotels || 0}</span>
                      <button 
                        className="btn btn-tiny" 
                        onClick={() => updateHotels(property.id, 1)}
                        disabled={(property.hotels || 0) === MAX_HOTELS}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="property-card-body">
                  <div className="owners-section">
                    <strong>Propriétaires:</strong>
                    {property.owners.length === 0 ? (
                      <span className="no-owners"> Aucun</span>
                    ) : (
                      <div className="owners-list">
                        {property.owners.map(owner => {
                          const player = players.find(p => p.id === owner.playerId)
                          return player ? (
                            <span key={owner.playerId} className="owner-badge">
                              {player.name}: {owner.share}%
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="property-card-actions">
                  <button className="btn btn-small" onClick={() => openShareModal(property.id)}>📝 Gérer les parts</button>
                  <button 
                    className="btn btn-small btn-success" 
                    onClick={() => setRentModal({ open: true, propertyId: property.id, payerId: null })}
                    disabled={property.owners.length === 0}
                  >
                    💰 Collecter loyer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed Right Sidebar for History */}
        <div className="sidebar sidebar-right">
          <div className="sidebar-section">
            <h2>📜 Historique</h2>
            <div className="history-list">
              {history.length === 0 ? (
                <p className="empty-state">Aucune transaction</p>
              ) : (
                history.map(entry => (
                  <div key={entry.id} className="history-item">
                    <div className="time">{entry.time}</div>
                    <div className="history-text">{entry.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de partage des parts */}
      <Modal isOpen={shareModal.open} onClose={() => setShareModal({ open: false, propertyId: null })}>
        <h3>📝 Répartition des parts</h3>
        <p style={{ marginBottom: '15px', color: 'rgba(255,255,255,0.7)' }}>
          Propriété: {properties.find(p => p.id === shareModal.propertyId)?.name}
        </p>
        
        {players.map(player => (
          <div key={player.id} className="share-input">
            <label>{player.name}</label>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              value={shares[player.id] || 0}
              onChange={e => setShares({ ...shares, [player.id]: e.target.value })}
            />
            <span>%</span>
          </div>
        ))}
        
        <div className={`total-share ${totalShares === 100 ? 'valid' : 'invalid'}`}>
          Total: {totalShares}% {totalShares === 100 ? '✓' : '(doit être 100%)'}
        </div>
        
        <div className="action-buttons">
          <button className="btn" onClick={() => setShareModal({ open: false, propertyId: null })}>
            Annuler
          </button>
          <button 
            className="btn btn-success" 
            onClick={saveShares}
            disabled={totalShares !== 100 && totalShares !== 0}
          >
            Sauvegarder
          </button>
        </div>
      </Modal>

      {/* Modal de paiement de loyer */}
      <Modal isOpen={rentModal.open} onClose={() => setRentModal({ open: false, propertyId: null, payerId: null })}>
        <h3>💰 Collecter le loyer</h3>
        <p style={{ marginBottom: '15px', color: 'rgba(255,255,255,0.7)' }}>
          Propriété: {properties.find(p => p.id === rentModal.propertyId)?.name}
          <br />
          Loyer: {properties.find(p => p.id === rentModal.propertyId)?.rent}K
        </p>
        
        <label style={{ display: 'block', marginBottom: '10px' }}>Qui paye le loyer ?</label>
        <select 
          className="input"
          value={rentModal.payerId || ''}
          onChange={e => setRentModal({ ...rentModal, payerId: e.target.value })}
        >
          <option value="">-- Sélectionner un joueur --</option>
          {players.map(player => (
            <option key={player.id} value={player.id}>{player.name}</option>
          ))}
        </select>
        
        {rentModal.payerId && (
          <div className="rent-section">
            <h3>Répartition:</h3>
            {properties.find(p => p.id === rentModal.propertyId)?.owners.map(owner => {
              const player = players.find(p => p.id === owner.playerId)
              const property = properties.find(p => p.id === rentModal.propertyId)
              const amount = Math.floor(property.rent * owner.share / 100)
              return player ? (
                <div key={owner.playerId}>
                  {player.name} ({owner.share}%) → +{amount}K
                </div>
              ) : null
            })}
          </div>
        )}
        
        <div className="action-buttons">
          <button className="btn" onClick={() => setRentModal({ open: false, propertyId: null, payerId: null })}>
            Annuler
          </button>
          <button 
            className="btn btn-success" 
            onClick={collectRent}
            disabled={!rentModal.payerId}
          >
            Confirmer
          </button>
        </div>
      </Modal>

      {/* Modal de modification du loyer */}
      <Modal isOpen={editRentModal.open} onClose={() => setEditRentModal({ open: false, propertyId: null, newRent: '' })}>
        <h3>✏️ Modifier le loyer</h3>
        <p style={{ marginBottom: '15px', color: 'rgba(255,255,255,0.7)' }}>
          Propriété: {properties.find(p => p.id === editRentModal.propertyId)?.name}
        </p>
        
        <label style={{ display: 'block', marginBottom: '10px' }}>Nouveau loyer (K):</label>
        <input
          className="input"
          type="number"
          min="1"
          value={editRentModal.newRent}
          onChange={e => setEditRentModal({ ...editRentModal, newRent: e.target.value })}
          placeholder="Entrez le nouveau loyer"
        />
        
        <div className="action-buttons">
          <button className="btn" onClick={() => setEditRentModal({ open: false, propertyId: null, newRent: '' })}>
            Annuler
          </button>
          <button 
            className="btn btn-success" 
            onClick={saveRent}
            disabled={!isValidRent(editRentModal.newRent)}
          >
            Sauvegarder
          </button>
        </div>
      </Modal>
    </>
  )
}
