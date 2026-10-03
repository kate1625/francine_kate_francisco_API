import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronDown,
  CirclePlus,
  Layers3,
  LogOut,
  Package,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { api, clearSession, readSession, writeSession } from './api.js';

function App() {
  const [session, setSession] = useState(readSession);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All products');

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setPageError('');
    try {
      const data = await api.products();
      setProducts(data.products || []);
    } catch (error) {
      setPageError(error.message);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.accessToken) return;
    api.request('/auth/me')
      .then(({ user }) => {
        const current = readSession();
        if (current) {
          const next = { ...current, user };
          writeSession(next);
          setSession(next);
        }
      })
      .catch((error) => {
        clearSession();
        setSession(null);
        setPageError(error.message);
      });
    loadProducts();
  }, [session?.accessToken, loadProducts]);

  useEffect(() => {
    const expire = () => {
      setSession(null);
      setProducts([]);
      setNotice('Your session expired. Please sign in again.');
    };
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleProducts = useMemo(() => {
    const search = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !search ||
        product.product_name.toLowerCase().includes(search) ||
        (product.description || '').toLowerCase().includes(search);
      const matchesStock = category !== 'Low stock' || Number(product.quantity) < 10;
      return matchesSearch && matchesStock;
    });
  }, [products, query, category]);

  const stats = useMemo(() => ({
    count: products.length,
    units: products.reduce((total, product) => total + Number(product.quantity), 0),
    value: products.reduce(
      (total, product) => total + Number(product.price) * Number(product.quantity),
      0,
    ),
    lowStock: products.filter((product) => Number(product.quantity) < 10).length,
  }), [products]);

  async function handleAuth(event) {
    event.preventDefault();
    setAuthBusy(true);
    setPageError('');
    const fields = new FormData(event.currentTarget);
    const credentials = {
      email: fields.get('email').trim(),
      password: fields.get('password'),
    };
    if (authMode === 'register') {
      credentials.username = fields.get('username').trim();
    }

    try {
      const result = authMode === 'register'
        ? await api.register(credentials)
        : await api.login(credentials);
      const next = {
        accessToken: result.tokens.access_token,
        refreshToken: result.tokens.refresh_token,
        user: result.user,
      };
      writeSession(next);
      setSession(next);
      setNotice(authMode === 'register' ? 'Your account is ready.' : 'Welcome back.');
    } catch (error) {
      setPageError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    const refreshToken = session?.refreshToken;
    try {
      if (refreshToken) await api.logout(refreshToken);
    } catch {
      clearSession();
      setSession(null);
      setProducts([]);
      setNotice('Signed out on this device. The server could not revoke the refresh token.');
      return;
    }
    clearSession();
    setSession(null);
    setProducts([]);
    setNotice('You have been signed out.');
  }

  async function saveProduct(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const product = {
      product_name: fields.get('product_name').trim(),
      description: fields.get('description').trim(),
      price: fields.get('price'),
      quantity: fields.get('quantity'),
    };
    try {
      if (modal.product) {
        await api.updateProduct(modal.product.id, product);
        setNotice('Product details updated.');
      } else {
        await api.createProduct(product);
        setNotice('Product added to your inventory.');
      }
      setModal(null);
      await loadProducts();
    } catch (error) {
      setPageError(error.message);
    }
  }

  async function removeProduct(product) {
    if (!window.confirm(`Delete "${product.product_name}" from your inventory?`)) return;
    try {
      await api.deleteProduct(product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setNotice('Product deleted.');
    } catch (error) {
      setPageError(error.message);
    }
  }

  if (!session?.accessToken) {
    return (
      <main className="auth-shell">
        <div className="auth-art">
          <div className="brand brand-light"><span className="brand-mark"><Boxes size={19} /></span> stockroom</div>
          <div className="auth-art-content">
            <div className="eyebrow light-eyebrow"><span /> INVENTORY, IN GOOD ORDER</div>
            <h1>Everything in<br />its right place.</h1>
            <p>A calmer way to track the products that keep your business moving.</p>
            <div className="art-cards">
              <div className="art-card art-card-main"><Package size={20} /><strong>Thoughtful inventory</strong><span>Your products, clearly organized.</span><div className="art-bars"><i /><i /><i /><i /><i /><i /><i /></div></div>
              <div className="art-card art-card-float"><span className="float-icon"><Check size={14} /></span><strong>All caught up</strong><small>Everything looks good</small></div>
            </div>
          </div>
          <div className="auth-foot">PRODUCT MANAGEMENT <span>·</span> BUILT WITH LAVALUST</div>
        </div>
        <section className="auth-panel">
          <div className="auth-mobile-brand brand"><span className="brand-mark"><Boxes size={19} /></span> stockroom</div>
          <div className="auth-card">
            <div className="auth-icon"><ShieldCheck size={21} /></div>
            <div className="eyebrow">YOUR WORKSPACE</div>
            <h2>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="auth-subtitle">{authMode === 'login' ? 'Sign in to manage your inventory.' : 'Set up a secure account to get started.'}</p>
            {pageError && <div className="alert error-alert">{pageError}</div>}
            {notice && <div className="alert success-alert">{notice}</div>}
            <form className="auth-form" onSubmit={handleAuth}>
              {authMode === 'register' && (
                <label>Username<input name="username" minLength="3" maxLength="100" placeholder="e.g. alexmorgan" required /></label>
              )}
              <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@company.com" required /></label>
              <label>Password<input name="password" type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength="8" placeholder="At least 8 characters" required /></label>
              <button className="primary-button auth-submit" type="submit" disabled={authBusy}>
                {authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'} <ArrowUpRight size={17} />
              </button>
            </form>
            <p className="auth-switch">
              {authMode === 'login' ? 'New to Stockroom?' : 'Already have an account?'}
              <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setPageError(''); }}>
                {authMode === 'login' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </div>
          <div className="auth-panel-foot">Secure access, wherever your work takes you.</div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#" className="brand"><span className="brand-mark"><Boxes size={19} /></span> stockroom</a>
        <div className="workspace-switch"><span className="workspace-avatar">{(session.user?.username || 'S').slice(0, 1).toUpperCase()}</span><span><strong>My workspace</strong><small>Personal inventory</small></span><ChevronDown size={15} /></div>
        <div className="nav-label">WORKSPACE</div>
        <button className="nav-item active"><Layers3 size={17} /> Products <span>{stats.count}</span></button>
        <div className="sidebar-note"><div className="note-icon"><ShieldCheck size={17} /></div><strong>Your inventory,<br />securely managed.</strong><p>Changes sync to your account and stay up to date.</p></div>
        <div className="sidebar-user"><span className="user-avatar">{(session.user?.username || 'U').slice(0, 1).toUpperCase()}</span><div className="user-details"><strong>{session.user?.username}</strong><small>{session.user?.email}</small></div><button title="Sign out" onClick={handleLogout}><LogOut size={17} /></button></div>
      </aside>

      <main className="main-panel">
        <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <strong>Products</strong></div><div className="topbar-right"><span className="sync-status"><span /> Synced just now</span><button className="logout-button" onClick={handleLogout}><LogOut size={15} /> Log out</button><button className="profile-chip">{(session.user?.username || 'U').slice(0, 1).toUpperCase()}</button></div></header>
        <div className="content">
          <div className="page-heading">
            <div><div className="eyebrow">INVENTORY OVERVIEW</div><h1>Products <span>{stats.count}</span></h1><p>A clear view of what you have and what’s moving.</p></div>
            <button className="primary-button" onClick={() => { setPageError(''); setModal({ product: null }); }}><CirclePlus size={17} /> Add product</button>
          </div>

          {pageError && <div className="alert error-alert page-alert">{pageError}<button onClick={() => setPageError('')}><X size={16} /></button></div>}
          {notice && <div className="toast"><span><Check size={14} /></span>{notice}<button onClick={() => setNotice('')}><X size={15} /></button></div>}

          <section className="stat-grid">
            <article className="stat-card"><div className="stat-top"><span className="stat-icon lilac"><Package size={17} /></span><span className="stat-period">IN CATALOG</span></div><strong>{stats.count}</strong><small>Unique products</small><div className="stat-footer"><span className="stat-dot purple-dot" /> Your complete catalog</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon mint"><Boxes size={17} /></span><span className="stat-period">TOTAL STOCK</span></div><strong>{stats.units.toLocaleString()}</strong><small>Units on hand</small><div className="stat-footer"><span className="stat-dot green-dot" /> Across all products</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon peach"><ArrowUpRight size={17} /></span><span className="stat-period">STOCK VALUE</span></div><strong>${stats.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>Estimated retail value</small><div className="stat-footer"><span className="stat-dot orange-dot" /> Based on current prices</div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><ArrowDownToLine size={17} /></span><span className="stat-period">NEEDS ATTENTION</span></div><strong>{stats.lowStock}</strong><small>Low-stock products</small><div className="stat-footer"><span className={stats.lowStock ? 'stat-dot orange-dot' : 'stat-dot green-dot'} /> {stats.lowStock ? 'Fewer than 10 units' : 'Stock levels look good'}</div></article>
          </section>

          <section className="inventory-panel">
            <div className="inventory-heading"><div><h2>Your products</h2><p>Manage and keep track of your inventory.</p></div><button className="export-button" onClick={() => exportProducts(products)}><ArrowDownToLine size={15} /> Export</button></div>
            <div className="table-toolbar"><div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products..." /></div><button className={`filter-button ${category === 'Low stock' ? 'filter-active' : ''}`} onClick={() => setCategory(category === 'All products' ? 'Low stock' : 'All products')}>{category}<ChevronDown size={15} /></button></div>
            <div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>PRICE</th><th>QUANTITY</th><th>STATUS</th><th>ADDED</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {loadingProducts && <tr><td colSpan="6" className="empty-state">Loading your inventory…</td></tr>}
                {!loadingProducts && visibleProducts.map((product) => (
                  <tr key={product.id}>
                    <td><div className="product-cell"><span className="product-thumb"><Package size={18} /></span><span><strong>{product.product_name}</strong><small>{product.description || 'No description'}</small></span></div></td>
                    <td className="price-cell">${Number(product.price).toFixed(2)}</td>
                    <td>{Number(product.quantity)} <span className="units-label">units</span></td>
                    <td><span className={`status-pill ${Number(product.quantity) < 10 ? 'status-low' : 'status-good'}`}><i />{Number(product.quantity) < 10 ? 'Low stock' : 'In stock'}</span></td>
                    <td className="date-cell">{new Date(product.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td><div className="row-actions"><button title="Edit product" onClick={() => { setPageError(''); setModal({ product }); }}><Pencil size={15} /></button><button title="Delete product" className="delete-action" onClick={() => removeProduct(product)}><Trash2 size={15} /></button></div></td>
                  </tr>
                ))}
                {!loadingProducts && visibleProducts.length === 0 && <tr><td colSpan="6" className="empty-state"><span className="empty-icon"><Package size={23} /></span><strong>{products.length ? 'No products found' : 'Your inventory is ready'}</strong><small>{products.length ? 'Try another search or filter.' : 'Add your first product to get started.'}</small>{!products.length && <button className="text-button" onClick={() => setModal({ product: null })}>Add a product <ArrowUpRight size={14} /></button>}</td></tr>}
              </tbody>
            </table></div>
            <div className="table-footer"><span>Showing <strong>{visibleProducts.length}</strong> of <strong>{products.length}</strong> products</span><span className="footer-secure"><ShieldCheck size={14} /> Protected with secure access</span></div>
          </section>
          <footer className="app-footer"><span>STOCKROOM <i>·</i> PRODUCT MANAGEMENT</span><span>Thoughtful tools for everyday work.</span></footer>
        </div>
      </main>

      {modal && <ProductModal key={modal.product?.id || 'new'} product={modal.product} onClose={() => setModal(null)} onSave={saveProduct} />}
    </div>
  );
}

function ProductModal({ product, onClose, onSave }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><span className="modal-icon"><Package size={18} /></span><div><h2 id="modal-title">{product ? 'Edit product' : 'Add a product'}</h2><p>{product ? 'Update the details in your catalog.' : 'Add a new item to your inventory.'}</p></div></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
        <form className="product-form" onSubmit={onSave}>
          <label>Product name<input name="product_name" maxLength="100" defaultValue={product?.product_name || ''} placeholder="e.g. Canvas everyday tote" required autoFocus /></label>
          <label>Description <span className="optional">OPTIONAL</span><textarea name="description" rows="3" defaultValue={product?.description || ''} placeholder="A few details about this product…" /></label>
          <div className="form-grid"><label>Price<input name="price" type="number" min="0" max="99999999.99" step="0.01" defaultValue={product?.price || ''} placeholder="0.00" required /></label><label>Quantity<input name="quantity" type="number" min="0" step="1" defaultValue={product?.quantity ?? ''} placeholder="0" required /></label></div>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Check size={16} />{product ? 'Save changes' : 'Add product'}</button></div>
        </form>
      </section>
    </div>
  );
}

function exportProducts(products) {
  const headings = ['Product', 'Description', 'Price', 'Quantity', 'Created'];
  const rows = products.map((product) => [
    product.product_name,
    product.description || '',
    Number(product.price).toFixed(2),
    product.quantity,
    product.created_at,
  ]);
  const csv = [headings, ...rows]
    .map((row) => row.map((value) => {
      const text = String(value);
      const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replaceAll('"', '""')}"`;
    }).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'stockroom-products.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export default App;
