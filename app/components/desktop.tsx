'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Compass, Headphones, Link2, LogOut, Search } from 'lucide-react';
import { LEGAL_VERSION } from '../../lib/legal';
import { roomRegions } from '../../lib/room-regions';
import { RoomExperience } from './room-lobby';

type User = { id: string; name: string };
type ListedRoom = { id: string; name: string; description: string; region: string | null; online: number };
type Room = { id: string; name: string; description: string; private: number; owner: string; locked: boolean };

async function request<T>(path: string, body?: object): Promise<T> {
 const response = await fetch('/api/' + path, {
  signal: AbortSignal.timeout(12000),
  ...(body && { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
 });
 const data = await response.json();
 if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
 return data;
}

const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function Desktop() {
 const [rooms, setRooms] = useState<ListedRoom[]>([]);
 const [user, setUser] = useState<User | null>(null);
 const [room, setRoom] = useState<Room | null>(null);
 const [pendingRoom, setPendingRoom] = useState('');
 const [view, setView] = useState<'all' | 'active' | 'invite'>('all');
 const [search, setSearch] = useState('');
 const [ready, setReady] = useState(false);
 const [loaded, setLoaded] = useState(false);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [directoryError, setDirectoryError] = useState('');

 useEffect(() => {
  let cancelled = false;
  request<{ user: User | null }>('me').then(data => {
   if (!cancelled) setUser(data.user);
  }).catch(() => {
   if (!cancelled) setError('Não foi possível verificar sua sessão.');
  }).finally(() => {
   if (!cancelled) setReady(true);
  });
  return () => { cancelled = true; };
 }, []);

 useEffect(() => {
  if (room) return;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;
  async function update() {
   try {
    const data = await request<{ rooms: ListedRoom[] }>('discover');
    if (!cancelled) {
     setRooms(data.rooms);
     setDirectoryError('');
    }
   } catch {
    if (!cancelled) setDirectoryError('Não foi possível atualizar os servidores. Tentando novamente…');
   } finally {
    if (!cancelled) {
     setLoaded(true);
     timer = setTimeout(update, 15000);
    }
   }
  }
  void update();
  return () => { cancelled = true; clearTimeout(timer); };
 }, [room]);

 async function run(action: () => Promise<void>) {
  setBusy(true);
  setError('');
  try {
   await action();
  } catch (failure) {
   setError(failure instanceof Error ? failure.message : 'Não foi possível conectar.');
  } finally {
   setBusy(false);
  }
 }

 async function openRoom(id: string) {
  const data = await request<{ room: Room }>('rooms/' + id);
  setRoom(data.room);
  setPendingRoom('');
 }

 function chooseRoom(id: string) {
  if (user) void run(() => openRoom(id));
  else {
   setError('');
   setPendingRoom(id);
  }
 }

 function openInvite(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const value = String(new FormData(event.currentTarget).get('invite')).trim();
  let id = value;
  try {
   const link = new URL(value);
   id = link.origin === location.origin && link.pathname === '/app' ? link.searchParams.get('room') || '' : '';
  } catch {
   // Room codes can also be pasted directly.
  }
  if (!/^[a-f0-9]{24}$/.test(id)) {
   setError('Cole o convite deste servidor Screenlink ou o código da sala.');
   return;
  }
  chooseRoom(id);
 }

 function leave() {
  setError('');
  setRoom(null);
 }

 const currentRoom = room && user && !room.locked ? room : null;
 const query = normalize(search.trim());
 const visibleRooms = rooms.filter(item => (view !== 'active' || item.online > 0)
  && normalize(item.name + ' ' + item.description).includes(query));
 const activeCount = rooms.filter(item => item.online > 0).length;

 function navigate(next: typeof view) {
  leave();
  setView(next);
 }

 return <div className="desktop">
  <aside className="desktop-sidebar">
   <nav className="desktop-nav" aria-label="Servidores">
    <button type="button" onClick={() => navigate('all')} aria-pressed={!currentRoom && view === 'all'}>
     <Compass size={19}/><span>Explorar</span>
    </button>
    <button type="button" onClick={() => navigate('active')} aria-pressed={!currentRoom && view === 'active'}>
     <Headphones size={19}/><span>Em chamada</span>{activeCount > 0 && <small>{activeCount}</small>}
    </button>
    <button type="button" onClick={() => navigate('invite')} aria-pressed={!currentRoom && view === 'invite'}>
     <Link2 size={19}/><span>Abrir convite</span>
    </button>
   </nav>
   <div className="desktop-account">
    <span className="desktop-avatar" aria-hidden="true">{user ? user.name[0].toUpperCase() : <Headphones size={17}/>}</span>
    <div><strong>{user?.name || 'Visitante'}</strong><small>{user ? 'Sessão ativa' : 'Sem sessão'}</small></div>
    {user && <button type="button" title="Sair da sessão" aria-label="Sair da sessão" disabled={busy} onClick={() => void run(async () => {
     await request('logout', {});
     setUser(null);
     leave();
    })}><LogOut size={17}/></button>}
   </div>
  </aside>
  {currentRoom && user ? <div className="desktop-room">
   <RoomExperience key={currentRoom.id} room={currentRoom} user={user} onLeave={leave}/>
  </div> : <main className="desktop-main">
   <header className="desktop-heading">
    <h1>{view === 'invite' ? 'Abrir convite' : view === 'active' ? 'Salas em chamada' : 'Explorar servidores'}</h1>
    {view !== 'invite' && <label className="desktop-field desktop-search">
     <Search size={17}/><input aria-label="Buscar servidores" placeholder="Buscar servidores" value={search} onChange={event => setSearch(event.target.value)}/>
    </label>}
   </header>
   <div className="desktop-content">
    {error && !pendingRoom && !room && <p className="error" role="alert">{error}</p>}
    {view === 'invite' ? <form className="desktop-invite" onSubmit={openInvite}>
     <p>Cole o link de convite ou o código da sala.</p>
     <label className="desktop-field"><Link2 size={17}/><input name="invite" aria-label="Link de convite ou código" placeholder="Link de convite ou código" required/></label>
     <button className="primary" disabled={!ready || busy}>Abrir sala <ArrowUpRight size={16}/></button>
    </form> : <section aria-label="Resultados da busca">
     {directoryError && <p role="status">{directoryError}</p>}
     {!loaded && <p role="status">Buscando servidores…</p>}
     {loaded && !directoryError && !visibleRooms.length && <p>{query ? 'Nenhum servidor corresponde à busca.' : view === 'active' ? 'Nenhuma sala em chamada agora.' : 'Nenhum servidor público disponível.'}</p>}
     <div className="desktop-list">
      {visibleRooms.map(item => <button key={item.id} disabled={!ready || busy} onClick={() => chooseRoom(item.id)}>
       <span className="desktop-room-icon"><Headphones size={21}/></span>
       <span className="desktop-room-copy"><strong>{item.name}</strong><small>{item.description || roomRegions.find(region => region.id === item.region)?.label || 'Sala pública'}</small></span>
       <span className={item.online ? 'desktop-online' : 'desktop-idle'}>{item.online ? `${item.online} na call` : 'Sala aberta'}</span>
       <ArrowUpRight className="desktop-room-arrow" size={17}/>
      </button>)}
     </div>
    </section>}
   </div>
  </main>}
  {(pendingRoom || room?.locked) && <AccessDialog busy={busy} close={() => { setPendingRoom(''); leave(); }}>
   <h2>{room?.locked ? room.name : 'Entrar como convidado'}</h2>
   <form onSubmit={event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void run(async () => {
     if (room?.locked) {
      await request('rooms/' + room.id + '/join', { password: fields.get('password') });
      setRoom({ ...room, locked: false });
     } else {
      if (!user) {
       const data = await request<{ user: User }>('auth/guest', { name: fields.get('name'), terms: fields.get('terms') });
       setUser(data.user);
      }
      await openRoom(pendingRoom);
     }
    });
   }}>
    {room?.locked ? <label>Senha da sala<input name="password" type="password" maxLength={128} required autoFocus/></label> : !user && <>
     <label>Seu nome ou apelido<input name="name" autoComplete="nickname" minLength={2} maxLength={40} required autoFocus/></label>
     <label className="desktop-terms"><input name="terms" type="checkbox" value={LEGAL_VERSION} required/><span>Li e aceito os <a href="/termos" target="_blank" rel="noreferrer">Termos de Uso</a> e estou ciente da <a href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a>.</span></label>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="desktop-dialog-actions">
     <button type="button" className="secondary" disabled={busy} onClick={() => { setPendingRoom(''); leave(); }}><ArrowLeft size={16}/> Voltar</button>
     <button className="primary" disabled={busy}>{busy ? 'Conectando…' : 'Entrar na sala'}</button>
    </div>
   </form>
  </AccessDialog>}
 </div>;
}

function AccessDialog({ children, close, busy }: { children: React.ReactNode; close: () => void; busy: boolean }) {
 return <dialog ref={element => { if (element && !element.open) element.showModal(); }}
  className="desktop-dialog modal" aria-labelledby="desktop-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
  <span id="desktop-dialog-title" className="sr-only">Acesso à sala</span>
  {children}
 </dialog>;
}
