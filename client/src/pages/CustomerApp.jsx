import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Award,
  CakeSlice,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChefHat,
  ChevronRight,
  Clock,
  Coffee,
  CreditCard,
  CupSoda,
  ExternalLink,
  Gift,
  History,
  Lock,
  LogOut,
  MapPin,
  Minus,
  Plus,
  QrCode,
  RefreshCw,
  Sandwich,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  ThermometerSnowflake,
  User,
  Users,
  Utensils,
  VolumeX,
  Zap,
  Bell,
  AlertTriangle,
  CheckCheck,
  Copy,
  Heart,
  MessageSquare,
  X,
  Search,
  Wifi,
  Flame,
  Info,
  ChevronDown,
  SlidersHorizontal,
  Share2,
  Link2,
  Edit3,
  Settings,
  MoreVertical,
  Pencil,
  Salad,
  UtensilsCrossed,
  Apple,
  Layers,
  Leaf,
  Pizza,
  Tag
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api, BASE } from '../api';
import { loadPaymentSdk } from '../paymentGateways';

function DietaryBadge({ isVeg, size = 14, className = '' }) {
  return (
    <span
      className={`fssai-indicator ${isVeg ? 'veg' : 'non-veg'} ${className}`}
      title={isVeg ? '100% Vegetarian' : 'Non-Vegetarian'}
      aria-label={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
      style={size !== 14 ? { width: size, height: size } : undefined}
    >
      <span className="fssai-inner" />
    </span>
  );
}

function InstagramIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function getAspectIcon(label) {
  switch (label) {
    case 'Artisan Coffee': return <Coffee size={13} />;
    case 'Fresh Pastries': return <CakeSlice size={13} />;
    case 'Speedy Service': return <Zap size={13} />;
    case 'Chic Ambience': return <Sparkles size={13} />;
    case 'Warm Hospitality': return <ChefHat size={13} />;
    case 'Great Value': return <Award size={13} />;
    case 'Slow Service': return <Clock size={13} />;
    case 'Food Was Cold': return <ThermometerSnowflake size={13} />;
    case 'Noise Level': return <VolumeX size={13} />;
    case 'Cleanliness': return <Sparkles size={13} />;
    case 'Order Accuracy': return <CheckSquare size={13} />;
    case 'Staff Courtesy': return <ChefHat size={13} />;
    default: return null;
  }
}

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(n || 0);


function FaveBrandLogo() {
  return (
    <div className="fave-brand-logo-group">
      <div className="fave-brand-symbol">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8.5" cy="12" r="5.5" />
          <circle cx="15.5" cy="12" r="5.5" />
        </svg>
      </div>
      <span className="fave-brand-name">fave</span>
    </div>
  );
}

function getFaveItemVisual(item) {
  if (item?.image) return item.image;
  const name = (item?.name || '').toLowerCase();
  const cat = (item?.category || '').toLowerCase();
  if (name.includes('sandwich') || name.includes('toast') || name.includes('panini')) {
    return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80';
  }
  if (name.includes('hot-dog') || name.includes('hotdog') || name.includes('burger')) {
    return 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=600&auto=format&fit=crop&q=80';
  }
  if (name.includes('salad') || name.includes('bowl') || name.includes('caesar')) {
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80';
  }
  if (name.includes('pizza') || name.includes('flatbread') || name.includes('margherita')) {
    return 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&auto=format&fit=crop&q=80';
  }
  if (cat.includes('dessert') || cat.includes('bakery') || name.includes('cake') || name.includes('croissant') || name.includes('pastry')) {
    return 'https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=600&auto=format&fit=crop&q=80';
  }
  if (cat.includes('coffee') || cat.includes('tea') || cat.includes('beverage') || name.includes('latte') || name.includes('brew')) {
    return 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80';
  }
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
}

function getFaveItemKcal(item) {
  if (item?.calories) return `${item.calories} kcal`;
  let hash = 0;
  const str = item?.name || 'Item';
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  const base = 280 + (Math.abs(hash) % 160);
  return `${base} kcal`;
}

function getFaveItemRecipe(item) {
  if (item?.description && item.description.trim().length > 10) {
    return item.description;
  }
  const name = (item?.name || '').toLowerCase();
  if (name.includes('sandwich')) return 'bread, eggs, butter, tomato, lettuce, cheese, mayonnaise';
  if (name.includes('hot-dog') || name.includes('hotdog')) return 'bread, eggs, lettuce, cheese, mayonnaise';
  if (name.includes('salad')) return 'bread, eggs, butter, tomato, lettuce, cheese, mayonnaise';
  if (name.includes('pizza')) return 'bread, eggs, lettuce, cheese, mayonnaise';
  if (name.includes('coffee') || name.includes('latte') || name.includes('brew')) return 'arabica beans, fresh steamed milk, vanilla bean extract';
  return 'bread, fresh herbs, butter, seasoning, olive oil';
}

export default function CustomerApp() {
  const { slug } = useParams();
  const [cafe, setCafe] = useState();
  const [cart, setCart] = useState({});
  const [tab, setTab] = useState('menu');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dietFilter, setDietFilter] = useState('all'); // 'all', 'veg', 'non-veg', 'bestseller'
  const [selectedItemModal, setSelectedItemModal] = useState(null);
  const [itemCustomNote, setItemCustomNote] = useState('');
  const [itemModalQty, setItemModalQty] = useState(1);

  function openItemModal(item) {
    setItemCustomNote('');
    setItemModalQty(1);
    setSelectedItemModal(item);
  }

  function closeItemModal() {
    setItemCustomNote('');
    setItemModalQty(1);
    setSelectedItemModal(null);
  }
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [placed, setPlaced] = useState(() => {
    try {
      const saved = localStorage.getItem(`gusstora_active_order_${slug}`);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed?.status === 'completed') {
        try { localStorage.removeItem(`gusstora_active_order_${slug}`); } catch {}
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [orderSyncing, setOrderSyncing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    table: '1',
    paymentMethod: 'cash',
    rewardId: ''
  });
  const [loyalty, setLoyalty] = useState();
  const [booking, setBooking] = useState({
    name: '',
    phone: '',
    guests: 2,
    dateTime: '',
    note: ''
  });
  const [notice, setNotice] = useState('');
  const [faveMenuType, setFaveMenuType] = useState('Main Menu');
  const [faveMenuDropdownOpen, setFaveMenuDropdownOpen] = useState(false);
  const [faveTagsDropdownOpen, setFaveTagsDropdownOpen] = useState(false);
  const [faveSortDropdownOpen, setFaveSortDropdownOpen] = useState(false);
  const [faveSortBy, setFaveSortBy] = useState('featured');
  const [faveQrModalOpen, setFaveQrModalOpen] = useState(false);
  const [faveManageModalOpen, setFaveManageModalOpen] = useState(false);
  const [faveSettingsModalOpen, setFaveSettingsModalOpen] = useState(false);
  const [faveCopiedLink, setFaveCopiedLink] = useState(false);
  const [activePaymentModal, setActivePaymentModal] = useState(null);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [stripePaymentReady, setStripePaymentReady] = useState(false);
  const paymentElementContainer = useRef(null);
  const stripeClient = useRef(null);
  const stripeElements = useRef(null);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [upsellSuggestions, setUpsellSuggestions] = useState([]);


  // Auto-detect table param from QR code link
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tbl = params.get('table');
      if (tbl) setForm(f => ({ ...f, table: tbl }));
    } catch {}
  }, []);

  // Customer Authentication & History State
  const [customerAuth, setCustomerAuth] = useState(() => {
    try {
      const saved = localStorage.getItem(`gusstora_customer_${slug}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [customerHistory, setCustomerHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // OTP Verification Modal State
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpStep, setOtpStep] = useState(1); // 1: input phone/name, 2: input otp code
  const [otpName, setOtpName] = useState('');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState('');
  const [claimingRewardId, setClaimingRewardId] = useState(null);
  const [selectedVoucherQr, setSelectedVoucherQr] = useState(null);

  // Phase 7: Diner Feedback & Google Review Booster State
  const [orderRating, setOrderRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedAspects, setSelectedAspects] = useState([]);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [existingOrderFeedback, setExistingOrderFeedback] = useState(null);
  const [copiedCompliment, setCopiedCompliment] = useState(false);
  const [historyRatingOrder, setHistoryRatingOrder] = useState(null);

  const positiveAspectsList = [
    'Artisan Coffee',
    'Fresh Pastries',
    'Speedy Service',
    'Chic Ambience',
    'Warm Hospitality',
    'Great Value'
  ];

  const criticalAspectsList = [
    'Slow Service',
    'Food Was Cold',
    'Noise Level',
    'Cleanliness',
    'Order Accuracy',
    'Staff Courtesy'
  ];

  const presetCompliments = [
    'Exceptional coffee craftsmanship and warm hospitality!',
    'Best specialty coffee in town! Fast service & delicious artisan bites.',
    'Aesthetic vibe, fantastic espresso, and wonderfully friendly staff!',
    'A true hidden gem for specialty coffee lovers. 10/10 experience!'
  ];

  function toggleFeedbackAspect(aspect) {
    setSelectedAspects(prev =>
      prev.includes(aspect) ? prev.filter(a => a !== aspect) : [...prev, aspect]
    );
  }

  function handleSelectCompliment(text) {
    setFeedbackComment(text);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopiedCompliment(true);
      setTimeout(() => setCopiedCompliment(false), 2600);
    }
  }

  async function checkOrderFeedback(orderId) {
    if (!slug || !orderId) return;
    try {
      const res = await api(`/public/cafes/${slug}/orders/${orderId}/feedback`);
      if (res?.hasFeedback && res?.feedback) {
        setExistingOrderFeedback(res.feedback);
        setOrderRating(res.feedback.rating);
        setSelectedAspects(res.feedback.aspects || []);
        setFeedbackComment(res.feedback.comment || '');
        setFeedbackSubmitted(true);
      } else {
        setExistingOrderFeedback(null);
        setFeedbackSubmitted(false);
        setOrderRating(0);
        setSelectedAspects([]);
        setFeedbackComment('');
      }
    } catch {
      // ignore
    }
  }

  async function handleSubmitFeedback(targetOrder = placed) {
    const orderToRate = targetOrder || historyRatingOrder;
    if (!orderToRate) return;
    if (!orderRating) {
      setNotice('Please select a star rating first');
      return;
    }

    const orderId = orderToRate._id || orderToRate.id;
    const sentiment = orderRating >= 4 ? 'positive' : 'critical';
    const isPublic = orderRating >= 4;
    const dinerName = customerAuth?.name || form.name || 'Valued Guest';
    const dinerPhone = customerAuth?.phone || form.phone || '';

    setSubmittingFeedback(true);
    try {
      const res = await api(`/public/cafes/${slug}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          rating: orderRating,
          sentiment,
          aspects: selectedAspects,
          comment: feedbackComment,
          dinerName,
          dinerPhone,
          isPublic
        })
      });

      setFeedbackSubmitted(true);
      setExistingOrderFeedback(res.feedback);
      if (sentiment === 'positive') {
        setNotice('Thank you for your review! Feel free to copy & post to Google Maps.');
      } else {
        setNotice('Thank you. Your feedback has been sent directly to cafe management.');
      }

      if (historyRatingOrder) {
        setHistoryRatingOrder(null);
        if (dinerPhone) loadCustomerHistory(dinerPhone);
      }
    } catch (err) {
      setNotice(err.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  }

  function openRatingModalForOrder(o) {
    setHistoryRatingOrder(o);
    if (o.Feedback) {
      setOrderRating(o.Feedback.rating);
      setSelectedAspects(o.Feedback.aspects || []);
      setFeedbackComment(o.Feedback.comment || '');
      setFeedbackSubmitted(true);
      setExistingOrderFeedback(o.Feedback);
    } else {
      setOrderRating(0);
      setHoverRating(0);
      setSelectedAspects([]);
      setFeedbackComment('');
      setFeedbackSubmitted(false);
      setExistingOrderFeedback(null);
      checkOrderFeedback(o._id || o.id);
    }
  }

  useEffect(() => {
    if (placed?._id || placed?.id) {
      checkOrderFeedback(placed._id || placed.id);
    }
  }, [placed?._id, placed?.id, slug]);

  async function handleClaimVoucher(rewardId) {
    setClaimingRewardId(rewardId);
    try {
      const res = await api(`/public/cafes/${slug}/rewards/${rewardId}/claim`, {
        method: 'POST',
      });
      setNotice(res.message || 'Voucher claimed! Ready for in-store redemption.');
      const currentPhone = customerAuth?.phone || form.phone;
      if (currentPhone) {
        lookupLoyalty(currentPhone);
        loadCustomerHistory(currentPhone);
      }
      if (res.reward) {
        setSelectedVoucherQr(res.reward);
      }
    } catch (err) {
      setNotice(err.message || 'Failed to claim voucher');
    } finally {
      setClaimingRewardId(null);
    }
  }

  useEffect(() => {
    api(`/public/cafes/${slug}`)
      .then(setCafe)
      .catch(e => setNotice(e.message));
  }, [slug]);

  // Sync saved customer identity to checkout form and fetch history
  useEffect(() => {
    if (customerAuth?.phone) {
      setForm(f => ({
        ...f,
        name: customerAuth.name || f.name,
        phone: customerAuth.phone
      }));
      lookupLoyalty(customerAuth.phone);
      loadCustomerHistory(customerAuth.phone);
    }
  }, [customerAuth, slug]);

  // Real-Time SSE listener for diner order tracking
  useEffect(() => {
    if (!slug) return;
    const es = new EventSource(`${BASE}/events/cafe/${slug}`);

    es.addEventListener('order_updated', e => {
      try {
        const updated = JSON.parse(e.data);
        setPlaced(current => {
          if (
            current &&
            (current.orderNo === updated.orderNo ||
              current._id === updated.id ||
              current.id === updated.id ||
              current._id === updated._id)
          ) {
            const merged = { ...current, ...updated };
            try {
              localStorage.setItem(`gusstora_active_order_${slug}`, JSON.stringify(merged));
            } catch {}
            return merged;
          }
          return current;
        });

        // Also refresh history if diner phone matches
        const activePhone = customerAuth?.phone || form.phone;
        if (activePhone && updated.phone === activePhone) {
          loadCustomerHistory(activePhone);
        }
      } catch (err) {
        console.error('SSE customer order update error:', err);
      }
    });

    return () => {
      es.close();
    };
  }, [slug, customerAuth?.phone, form.phone]);

  async function refreshOrderStatus() {
    if (!placed?.orderNo) return;
    setOrderSyncing(true);
    try {
      const updated = await api(`/public/cafes/${slug}/orders/${placed.orderNo}`);
      if (updated) {
        setPlaced(updated);
        try {
          localStorage.setItem(`gusstora_active_order_${slug}`, JSON.stringify(updated));
        } catch {}
      }
    } catch (err) {
      console.warn('Could not sync order status:', err);
    } finally {
      setOrderSyncing(false);
    }
  }

  function handleDismissTracker() {
    try { localStorage.removeItem(`gusstora_active_order_${slug}`); } catch {}
    setPlaced(null);
    setTab('menu');
  }

  const lines = useMemo(() => Object.values(cart), [cart]);

  // Phase 12: Dynamic Roastery AI Upsell Suggestions
  useEffect(() => {
    if (!cafe || lines.length === 0) {
      setUpsellSuggestions([]);
      return;
    }
    const itemIds = lines.map(l => l.menuItemId || l._id || l.id).filter(Boolean);
    if (itemIds.length === 0) {
      setUpsellSuggestions([]);
      return;
    }

    let active = true;
    const cafeId = cafe._id || cafe.id;
    api(`/ai-roastery/upsell?cafeId=${cafeId}&itemIds=${itemIds.join(',')}`)
      .then(res => {
        if (active && res && Array.isArray(res.suggestions)) {
          const inCartIds = new Set(itemIds.map(String));
          const filtered = res.suggestions.filter(s => {
            const sid = s.suggestedItem?._id || s.suggestedItem?.id;
            return sid && !inCartIds.has(String(sid));
          });
          setUpsellSuggestions(filtered);
        }
      })
      .catch(() => {
        if (active) setUpsellSuggestions([]);
      });

    return () => {
      active = false;
    };
  }, [cafe, lines.length, lines.map(l => l.menuItemId || l._id || l.id).join(',')]);

  const total = useMemo(
    () => lines.reduce((s, i) => s + (i.unitPrice || i.price) * i.quantity, 0),
    [lines]
  );
  const totalItemCount = useMemo(
    () => lines.reduce((s, i) => s + i.quantity, 0),
    [lines]
  );
  const promoDiscountAmount = useMemo(
    () => (appliedPromo ? Number(appliedPromo.discountAmount || 0) : 0),
    [appliedPromo]
  );
  const finalPayable = useMemo(
    () => Math.max(0, total - promoDiscountAmount),
    [total, promoDiscountAmount]
  );

  const categories = useMemo(() => {
    if (!cafe?.menu) return [];
    return ['All', ...new Set(cafe.menu.map(i => i.category))];
  }, [cafe?.menu]);

  function getItemCartCount(itemId) {
    return lines
      .filter(l => l.menuItemId === itemId || l._id === itemId)
      .reduce((s, l) => s + l.quantity, 0);
  }

  function updateCartQty(cartKey, d) {
    setCart(prev => {
      const existing = prev[cartKey];
      if (!existing) return prev;
      const next = existing.quantity + d;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[cartKey];
        return copy;
      }
      return {
        ...prev,
        [cartKey]: { ...existing, quantity: next }
      };
    });
  }

  function addStandardItem(item, d = 1, note = '') {
    const itemId = item._id || item.id;
    const cleanNotes = (note || '').trim();
    const cartKey = cleanNotes ? `${itemId}_std_n_${cleanNotes}` : `${itemId}_std`;
    setCart(prev => {
      const existing = prev[cartKey];
      const next = (existing?.quantity || 0) + d;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[cartKey];
        return copy;
      }
      return {
        ...prev,
        [cartKey]: {
          cartKey,
          menuItemId: itemId,
          name: item.name,
          price: Number(item.price) || 0,
          unitPrice: Number(item.price) || 0,
          quantity: next,
          selectedVariant: null,
          selectedModifiers: [],
          notes: cleanNotes || existing?.notes || '',
          image: item.image,
          veg: item.veg,
          category: item.category
        }
      };
    });
  }

  function qty(id, d, note = '') {
    if (cart[id]) {
      updateCartQty(id, d);
      return;
    }
    const item = cafe?.menu?.find(m => (m._id || m.id) === id);
    if (!item) return;
    addStandardItem(item, d, note);
  }

  // Artisan Customization Modal State & Handlers
  const [customizingItem, setCustomizingItem] = useState(null);
  const [customVariant, setCustomVariant] = useState(null);
  const [customModifiers, setCustomModifiers] = useState([]);
  const [customNotes, setCustomNotes] = useState('');
  const [customQty, setCustomQty] = useState(1);

  function openCustomization(item) {
    setCustomizingItem(item);
    if (Array.isArray(item.variants) && item.variants.length > 0) {
      setCustomVariant(item.variants[0]);
    } else {
      setCustomVariant(null);
    }
    const initialMods = [];
    if (Array.isArray(item.modifierGroups)) {
      item.modifierGroups.forEach(group => {
        if (group.required && group.maxSelect === 1 && Array.isArray(group.options) && group.options.length > 0) {
          initialMods.push({
            id: group.options[0].id,
            name: group.options[0].name,
            price: Number(group.options[0].price || 0),
            groupId: group.id,
            groupName: group.name
          });
        }
      });
    }
    setCustomModifiers(initialMods);
    setCustomNotes('');
    setCustomQty(1);
  }

  function toggleCustomModifier(group, option) {
    setCustomModifiers(prev => {
      const isSelected = prev.some(m => m.id === option.id);
      if (isSelected) {
        return prev.filter(m => m.id !== option.id);
      }
      if (group.maxSelect === 1) {
        const withoutGroup = prev.filter(m => m.groupId !== group.id);
        return [
          ...withoutGroup,
          {
            id: option.id,
            name: option.name,
            price: Number(option.price || 0),
            groupId: group.id,
            groupName: group.name
          }
        ];
      }
      const currentInGroup = prev.filter(m => m.groupId === group.id);
      if (group.maxSelect && currentInGroup.length >= group.maxSelect) {
        return prev;
      }
      return [
        ...prev,
        {
          id: option.id,
          name: option.name,
          price: Number(option.price || 0),
          groupId: group.id,
          groupName: group.name
        }
      ];
    });
  }

  function commitCustomizedItem() {
    if (!customizingItem) return;
    const vId = customVariant?.id ? String(customVariant.id) : 'std';
    const mIds = (customModifiers || []).map(m => String(m.id)).sort().join('_');
    const cleanNotes = (customNotes || '').trim();
    const itemId = customizingItem._id || customizingItem.id;
    const cartKey = `${itemId}_v${vId}_m${mIds}_n${cleanNotes}`;

    const basePrice = customVariant ? Number(customVariant.price || 0) : Number(customizingItem.price || 0);
    const modTotal = (customModifiers || []).reduce((sum, m) => sum + Number(m.price || 0), 0);
    const unitPrice = basePrice + modTotal;

    setCart(prev => {
      const existing = prev[cartKey];
      const newQty = (existing?.quantity || 0) + customQty;
      return {
        ...prev,
        [cartKey]: {
          cartKey,
          menuItemId: itemId,
          name: customizingItem.name,
          price: unitPrice,
          unitPrice,
          quantity: newQty,
          selectedVariant: customVariant ? { id: customVariant.id, name: customVariant.name, price: Number(customVariant.price) } : null,
          selectedModifiers: (customModifiers || []).map(m => ({ id: m.id, name: m.name, price: Number(m.price) })),
          notes: cleanNotes,
          image: customizingItem.image,
          veg: customizingItem.veg,
          category: customizingItem.category
        }
      };
    });

    setCustomizingItem(null);
  }

  const modalUnitPrice = useMemo(() => {
    if (!customizingItem) return 0;
    const base = customVariant ? Number(customVariant.price || 0) : Number(customizingItem.price || 0);
    const modSum = (customModifiers || []).reduce((s, m) => s + Number(m.price || 0), 0);
    return base + modSum;
  }, [customizingItem, customVariant, customModifiers]);

  const modalTotalPrice = modalUnitPrice * customQty;

  const missingRequiredGroup = useMemo(() => {
    if (!customizingItem || !Array.isArray(customizingItem.modifierGroups)) return null;
    for (const group of customizingItem.modifierGroups) {
      if (group.required) {
        const selectedInGroup = (customModifiers || []).filter(m => m.groupId === group.id);
        const minNeeded = group.minSelect || 1;
        if (selectedInGroup.length < minNeeded) {
          return group.name;
        }
      }
    }
    return null;
  }, [customizingItem, customModifiers]);

  async function lookupLoyalty(phoneToLookup) {
    const rawPhone = (phoneToLookup || form.phone).replace(/\D/g, '');
    if (rawPhone.length >= 10) {
      try {
        const data = await api(`/public/cafes/${slug}/loyalty/${rawPhone}`);
        setLoyalty(data);
      } catch (err) {
        // silently ignore lookup fail
      }
    }
  }

  async function loadCustomerHistory(phoneToLookup) {
    const rawPhone = (phoneToLookup || customerAuth?.phone || '').replace(/\D/g, '');
    if (!rawPhone || rawPhone.length < 10) return;
    setHistoryLoading(true);
    try {
      const data = await api(`/public/cafes/${slug}/customers/${rawPhone}/history`);
      setCustomerHistory(data);
    } catch (err) {
      console.error('History load error:', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  // Handle OTP Request (Step 1)
  async function handleRequestOtp(e) {
    e.preventDefault();
    const cleanPhone = otpPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setNotice('Please enter a valid 10-digit mobile number');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await api('/public/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone: cleanPhone,
          name: otpName.trim() || 'Valued Guest'
        })
      });
      setDevOtpHint(res.devOtp || '1234');
      setOtpStep(2);
      setNotice('Verification code sent to ' + cleanPhone);
    } catch (err) {
      setNotice(err.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  }

  // Handle OTP Verification (Step 2)
  async function handleVerifyOtp(e) {
    e.preventDefault();
    const cleanPhone = otpPhone.replace(/\D/g, '');
    if (!otpCode || otpCode.length < 4) {
      setNotice('Please enter the 4-digit verification code');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await api('/public/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone: cleanPhone,
          otp: otpCode,
          slug
        })
      });

      const authData = {
        phone: res.customer.phone,
        name: res.customer.name,
        customerId: res.customer._id
      };
      localStorage.setItem(`gusstora_customer_${slug}`, JSON.stringify(authData));
      setCustomerAuth(authData);
      setLoyalty(res.loyalty);
      setOtpModalOpen(false);
      setOtpCode('');
      setOtpStep(1);
      setNotice(`Welcome, ${authData.name}! Your VIP Passport is active.`);
      loadCustomerHistory(authData.phone);
    } catch (err) {
      setNotice(err.message || 'Invalid or expired OTP');
    } finally {
      setOtpLoading(false);
    }
  }

  function handleLogoutCustomer() {
    localStorage.removeItem(`gusstora_customer_${slug}`);
    setCustomerAuth(null);
    setCustomerHistory(null);
    setNotice('Signed out from your VIP Passport.');
  }

  function openOtpModalForPhone(existingPhone = '') {
    setOtpPhone(existingPhone || form.phone || '');
    setOtpName(form.name || '');
    setOtpStep(1);
    setOtpCode('');
    setOtpModalOpen(true);
  }

  async function handleApplyPromo() {
    if (!promoCodeInput.trim()) return;
    setPromoValidating(true);
    setPromoError('');
    try {
      const res = await api(`/public/cafes/${slug}/promo-codes/validate`, {
        method: 'POST',
        body: JSON.stringify({
          code: promoCodeInput.trim(),
          orderSubtotal: total,
          customerPhone: form.phone || customerAuth?.phone
        })
      });
      if (res && res.valid) {
        setAppliedPromo(res);
        setNotice(`Promo "${res.code}" applied! Saved ${money(res.discountAmount)}`);
      } else {
        setPromoError(res?.error || 'Invalid or expired promo code');
      }
    } catch (err) {
      setPromoError(err.message || 'Promo code could not be applied');
    } finally {
      setPromoValidating(false);
    }
  }

  function handleRemovePromo() {
    setAppliedPromo(null);
    setPromoCodeInput('');
    setPromoError('');
  }

  async function order(e) {
    e.preventDefault();
    try {
      const r = await api(`/public/cafes/${slug}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          discountType: appliedPromo?.discountType || null,
          discountValue: appliedPromo?.discountValue || 0,
          promoCode: appliedPromo?.code || null,
          items: lines.map(i => ({
            menuItemId: i.menuItemId || i._id,
            quantity: i.quantity,
            selectedVariant: i.selectedVariant,
            selectedModifiers: i.selectedModifiers,
            notes: i.notes
          }))
        })
      });
      setPlaced(r);
      try {
        localStorage.setItem(`gusstora_active_order_${slug}`, JSON.stringify(r));
      } catch {}
      setCart({});
      setCheckout(false);
      setAppliedPromo(null);
      setPromoCodeInput('');
      setTab('tracker');

      // Auto update history if customer is identified
      if (form.phone) {
        lookupLoyalty(form.phone);
        loadCustomerHistory(form.phone);
      }

      // If diner chose an online gateway and payment is pending, trigger payment modal
      if (['upi', 'razorpay', 'stripe'].includes(form.paymentMethod) && r.paymentStatus !== 'paid') {
        openPaymentGatewayModal(r, form.paymentMethod);
      }
    } catch (e) {
      setNotice(e.message);
    }
  }

  async function openPaymentGatewayModal(orderObj, gateway) {
    try {
      const intent = await api(`/public/cafes/${slug}/orders/${orderObj.id || orderObj._id}/payment-intent`, {
        method: 'POST',
        body: JSON.stringify({ gateway }),
      });
      setActivePaymentModal({
        order: orderObj,
        gateway,
        intent,
        verifying: false,
      });
    } catch (err) {
      setNotice(err.message || 'Could not initialize payment gateway.');
    }
  }

  useEffect(() => {
    if (activePaymentModal?.gateway === 'razorpay') {
      let cancelled = false;
      setRazorpayReady(false);
      loadPaymentSdk({
        globalName: 'Razorpay',
        src: 'https://checkout.razorpay.com/v1/checkout.js',
      })
        .then(() => {
          if (!cancelled) setRazorpayReady(true);
        })
        .catch(error => {
          if (!cancelled) setNotice(error.message || 'Could not load secure checkout.');
        });
      return () => {
        cancelled = true;
        setRazorpayReady(false);
      };
    }
    setRazorpayReady(false);

    if (activePaymentModal?.gateway !== 'stripe') {
      setStripePaymentReady(false);
      return undefined;
    }

    const { publishableKey, clientSecret } = activePaymentModal.intent || {};
    if (!publishableKey || !clientSecret || !paymentElementContainer.current) return undefined;

    let cancelled = false;
    let paymentElement;
    setStripePaymentReady(false);

    loadPaymentSdk({ globalName: 'Stripe', src: 'https://js.stripe.com/v3/' })
      .then(Stripe => {
        if (cancelled) return;
        const stripe = Stripe(publishableKey);
        const elements = stripe.elements({ clientSecret });
        paymentElement = elements.create('payment');
        paymentElement.on('ready', () => {
          if (!cancelled) setStripePaymentReady(true);
        });
        paymentElement.mount(paymentElementContainer.current);
        stripeClient.current = stripe;
        stripeElements.current = elements;
      })
      .catch(error => {
        if (!cancelled) setNotice(error.message || 'Could not load secure card checkout.');
      });

    return () => {
      cancelled = true;
      paymentElement?.unmount();
      stripeClient.current = null;
      stripeElements.current = null;
      setStripePaymentReady(false);
    };
  }, [
    activePaymentModal?.gateway,
    activePaymentModal?.intent?.clientSecret,
    activePaymentModal?.intent?.publishableKey,
  ]);

  async function handleConfirmGatewayPayment(transactionId, meta = {}) {
    if (!activePaymentModal) return;
    const { order: currentOrder, gateway } = activePaymentModal;
    const orderId = currentOrder.id || currentOrder._id;
    if (!transactionId) {
      setNotice('A payment provider confirmation is required.');
      return;
    }

    setActivePaymentModal(prev => ({ ...prev, verifying: true }));
    try {
      await api(`/public/cafes/${slug}/orders/${orderId}/confirm-payment`, {
        method: 'POST',
        body: JSON.stringify({
          gateway,
          transactionId,
          meta,
        }),
      });

      setPlaced(prev => ({
        ...prev,
        paymentStatus: 'paid',
        paymentMethod: gateway,
        paymentTransactionId: transactionId,
      }));

      try {
        const saved = JSON.parse(localStorage.getItem(`gusstora_active_order_${slug}`) || '{}');
        localStorage.setItem(`gusstora_active_order_${slug}`, JSON.stringify({
          ...saved,
          paymentStatus: 'paid',
          paymentMethod: gateway,
        }));
      } catch {}

      setActivePaymentModal(null);
      setNotice('Payment confirmed! Your order is being handcrafted.');
    } catch (err) {
      setNotice(err.message || 'Payment confirmation failed.');
      setActivePaymentModal(prev => ({ ...prev, verifying: false }));
    }
  }

  async function startRazorpayCheckout() {
    if (!activePaymentModal || activePaymentModal.gateway !== 'razorpay') return;
    if (!razorpayReady) {
      setNotice('Secure checkout is still loading. Please try again.');
      return;
    }
    setActivePaymentModal(previous => ({ ...previous, verifying: true }));
    try {
      const Razorpay = await loadPaymentSdk({
        globalName: 'Razorpay',
        src: 'https://checkout.razorpay.com/v1/checkout.js',
      });
      const { intent } = activePaymentModal;
      if (!intent?.keyId || !intent?.razorpayOrderId) {
        throw new Error('Razorpay checkout is not configured for this order.');
      }
      const checkout = new Razorpay({
        key: intent.keyId,
        amount: intent.amount,
        currency: intent.currency,
        name: intent.name,
        description: intent.description,
        order_id: intent.razorpayOrderId,
        prefill: intent.prefill,
        handler: response => handleConfirmGatewayPayment(response.razorpay_payment_id, {
          razorpayOrderId: response.razorpay_order_id,
          razorpaySignature: response.razorpay_signature,
        }),
        modal: {
          ondismiss: () => setActivePaymentModal(previous => previous
            ? { ...previous, verifying: false }
            : previous),
        },
      });
      checkout.on('payment.failed', response => {
        setNotice(response.error?.description || 'Razorpay payment failed. You can try again.');
      });
      checkout.open();
    } catch (error) {
      setActivePaymentModal(previous => previous ? { ...previous, verifying: false } : previous);
      setNotice(error.message || 'Could not open Razorpay checkout.');
    }
  }

  async function startStripeCheckout() {
    if (!activePaymentModal || activePaymentModal.gateway !== 'stripe') return;
    if (!stripeClient.current || !stripeElements.current) {
      setNotice('Secure card checkout is still loading. Please try again.');
      return;
    }
    setActivePaymentModal(previous => ({ ...previous, verifying: true }));
    try {
      const { error, paymentIntent } = await stripeClient.current.confirmPayment({
        elements: stripeElements.current,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      if (error) throw new Error(error.message || 'Stripe payment could not be confirmed.');
      if (paymentIntent?.status === 'succeeded') {
        await handleConfirmGatewayPayment(paymentIntent.id);
      } else {
        setActivePaymentModal(previous => previous ? { ...previous, verifying: false } : previous);
        setNotice('Payment is still processing. The order will update when the provider confirms it.');
      }
    } catch (error) {
      setActivePaymentModal(previous => previous ? { ...previous, verifying: false } : previous);
      setNotice(error.message || 'Stripe payment could not be completed.');
    }
  }

  async function book(e) {
    e.preventDefault();
    try {
      await api(`/public/cafes/${slug}/bookings`, {
        method: 'POST',
        body: JSON.stringify(booking)
      });
      setNotice('Table request sent! We will confirm your table shortly.');
      setBooking({ name: '', phone: '', guests: 2, dateTime: '', note: '' });
    } catch (e) {
      setNotice(e.message);
    }
  }

  const copyWifi = () => {
    const ssid = cafe?.wifiSsid || 'Gusstora-Roastery-5G';
    const pwd = cafe?.wifiPassword || 'perkbytecoffee';
    const text = `Wi-Fi: ${ssid} | Password: ${pwd}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopiedWifi(true);
      setTimeout(() => setCopiedWifi(false), 2400);
    }
  };

  const getItemAromaProfile = item => {
    if (!item) return { notes: '', prep: 'Freshly prepared', badge: '' };
    const cat = item.category?.toLowerCase() || '';
    const name = item.name?.toLowerCase() || '';
    if (cat.includes('coffee') || name.includes('latte') || name.includes('brew') || name.includes('cappuccino') || name.includes('espresso')) {
      return {
        notes: 'Dark Chocolate · Hazelnut · Velvet Crema',
        prep: '3–4 mins',
        badge: 'Specialty Roast',
        tag: 'Artisan Pour'
      };
    }
    if (cat.includes('dessert') || cat.includes('bakery') || name.includes('cake') || name.includes('croissant') || name.includes('brownie')) {
      return {
        notes: 'French Butter · Single-Origin Cocoa · Baked Daily',
        prep: 'Ready to serve',
        badge: 'Fresh Bake',
        tag: 'Artisan Pastry'
      };
    }
    if (cat.includes('tea') || name.includes('tea') || name.includes('matcha')) {
      return {
        notes: 'Botanical Florals · Whole Leaf Steep · Silky',
        prep: '4 mins',
        badge: 'Whole Leaf',
        tag: 'Master Blend'
      };
    }
    return {
      notes: 'Crisp Sourdough · Fresh Herb Infusion',
      prep: '8–10 mins',
      badge: 'Chef Choice',
      tag: 'Gourmet Savory'
    };
  };

  const categoryCounts = useMemo(() => {
    if (!cafe?.menu) return {};
    const counts = { All: cafe.menu.length };
    cafe.menu.forEach(item => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [cafe?.menu]);

  const menuCategories = useMemo(() => {
    if (!cafe?.menu || !Array.isArray(cafe.menu)) return [];
    const cats = [];
    const seen = new Set();
    cafe.menu.forEach(item => {
      const cat = (item.category || 'Specialties').trim();
      if (!seen.has(cat)) {
        seen.add(cat);
        cats.push({
          name: cat,
          count: categoryCounts[cat] || 1
        });
      }
    });
    return cats;
  }, [cafe?.menu, categoryCounts]);

  const getCategoryIcon = (catName) => {
    const lower = (catName || '').toLowerCase();
    if (lower.includes('coffee') || lower.includes('brew') || lower.includes('latte') || lower.includes('espresso')) return Coffee;
    if (lower.includes('drink') || lower.includes('beverage') || lower.includes('tea') || lower.includes('shake')) return CupSoda;
    if (lower.includes('dessert') || lower.includes('cake') || lower.includes('sweet') || lower.includes('bakery')) return CakeSlice;
    if (lower.includes('bite') || lower.includes('snack') || lower.includes('sandwich') || lower.includes('burger')) return Sandwich;
    if (lower.includes('pizza')) return Pizza;
    if (lower.includes('salad') || lower.includes('healthy') || lower.includes('veg')) return Salad;
    if (lower.includes('main') || lower.includes('pasta') || lower.includes('meal')) return UtensilsCrossed;
    return Utensils;
  };

  const signatureItems = useMemo(() => {
    if (!cafe?.menu) return [];
    const featured = cafe.menu.filter(i => i.bestseller || i.signature || (i.price >= 200 && i.price <= 350));
    return (featured.length > 0 ? featured : cafe.menu).slice(0, 5);
  }, [cafe?.menu]);

  const filteredMenu = useMemo(() => {
    if (!cafe?.menu) return [];
    let list = cafe.menu.filter(item => {
      // Category filter
      if (activeCategory !== 'All' && item.category !== activeCategory) {
        return false;
      }
      // Diet filter
      if (dietFilter === 'veg' && !item.veg) return false;
      if (dietFilter === 'non-veg' && item.veg) return false;
      if (dietFilter === 'bestseller' && !item.bestseller && item.price < 220) return false;
      if (dietFilter === 'gluten_free') {
        const desc = (item.description || '').toLowerCase();
        const isGf = item.glutenFree || desc.includes('gluten-free') || item.category === 'Coffee';
        if (!isGf) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name?.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        const matchesCat = item.category?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesCat) return false;
      }
      return true;
    });

    if (faveSortBy === 'price-asc') {
      list = [...list].sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (faveSortBy === 'price-desc') {
      list = [...list].sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (faveSortBy === 'name') {
      list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (faveSortBy === 'calories') {
      list = [...list].sort((a, b) => parseInt(getFaveItemKcal(a)) - parseInt(getFaveItemKcal(b)));
    }

    return list;
  }, [cafe?.menu, activeCategory, dietFilter, searchQuery, faveSortBy]);

  const googleReviewLink = cafe?.googleReviewUrl || 'https://g.page/r/gusstora-roastery/review';
  const instagramLink = cafe?.instagramUrl || 'https://instagram.com/gusstora.cafe';

  if (!cafe) {
    return (
      <div className="customer-loader-wrap">
        <div className="loader-coffee-box">
          <img src="/gusstora_emblem.png" alt="Gusstora" className="loader-logo-spin" />
        </div>
        <p>{notice || 'Brewing the menu…'}</p>
      </div>
    );
  }

  return (
    <div className="brix-app-shell">
      {/* ===================== LEFT SIDEBAR (OLIVE GREEN ~21% WIDTH) ===================== */}
      <aside className="brix-sidebar" aria-label="Café Sidebar">
        <div>
          {/* Brand Identity */}
          <div className="brix-sidebar-brand">
            <h1 className="brix-sidebar-brand-title">
              {cafe.name || 'THE DAILY GRIND'}
              <span className="brand-circle-mark">°</span>
            </h1>
            <p className="brix-sidebar-brand-subtitle">
              Artisan Café & Roastery · {cafe.address || 'C-Scheme, Jaipur'}
            </p>
            <div className="brix-sidebar-status-tag">
              <span className="pulse-dot" />
              <span>Roastery Open</span>
              {form.table && <span className="table-chip">Table #{form.table}</span>}
            </div>
          </div>

          {/* Vertical Category Navigation List */}
          <nav className="brix-sidebar-categories" aria-label="Menu Categories">
            <button
              type="button"
              className={`brix-category-item-btn ${activeCategory === 'All' && tab === 'menu' ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory('All');
                setTab('menu');
              }}
              title="All Dishes"
            >
              <span className="cat-name-span">All Dishes</span>
              {cafe?.menu?.length > 0 && (
                <span className="cat-count-subtle">{cafe.menu.length}</span>
              )}
            </button>

            {menuCategories.map(cat => {
              const isActive = activeCategory === cat.name && tab === 'menu';
              return (
                <button
                  key={cat.name}
                  type="button"
                  className={`brix-category-item-btn ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategory(isActive ? 'All' : cat.name);
                    setTab('menu');
                  }}
                  title={cat.name}
                >
                  <span className="cat-name-span">{cat.name}</span>
                  <span className="cat-count-subtle">{cat.count}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Customer Account, Wi-Fi, Table QR & Hours */}
        <div className="brix-sidebar-footer">
          {/* Customer Authentication Strip placed at the BOTTOM */}
          <div className="brix-sidebar-auth-section">
            {customerAuth ? (
              <div className="brix-sidebar-user-box">
                <div className="brix-sidebar-user-head">
                  <div className="brix-sidebar-user-avatar">
                    {(customerAuth.name || 'V').charAt(0).toUpperCase()}
                  </div>
                  <div className="brix-sidebar-user-meta">
                    <span className="brix-sidebar-user-name" title={customerAuth.name}>
                      {customerAuth.name || 'Valued Diner'}
                    </span>
                    <span className="brix-sidebar-user-phone">{customerAuth.phone}</span>
                  </div>
                  <span className="brix-sidebar-vip-badge">VIP</span>
                </div>
                <div className="brix-sidebar-user-btn-row">
                  <button
                    type="button"
                    className={`brix-sidebar-auth-link ${tab === 'history' ? 'active' : ''}`}
                    onClick={() => setTab('history')}
                    title="View My Activity & Stamps"
                  >
                    <History size={12} />
                    <span>My Activity</span>
                  </button>
                  <button
                    type="button"
                    className="brix-sidebar-auth-logout"
                    onClick={handleLogoutCustomer}
                    title="Log Out of Customer Account"
                  >
                    <LogOut size={12} />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="brix-sidebar-guest-box">
                <div className="brix-sidebar-guest-info">
                  <Award size={14} style={{ color: '#E8E1D6' }} />
                  <span>VIP Rewards Passport</span>
                </div>
                <button
                  type="button"
                  className="brix-sidebar-login-action-btn"
                  onClick={() => openOtpModalForPhone()}
                  title="Sign In with Mobile"
                >
                  <User size={13} />
                  <span>Customer Login</span>
                </button>
              </div>
            )}
          </div>


          <div className="brix-sidebar-meta-row">
            <span>8:00 AM – 11:00 PM</span>
            <a
              href={instagramLink}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title="Instagram @gusstora.cafe"
            >
              <InstagramIcon size={11} />
              <span>@gusstora.cafe</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Mobile Horizontal Category Track (Only on mobile) */}
      <div className="brix-mobile-categories-strip" aria-label="Mobile Categories">
        <button
          type="button"
          className={`brix-mobile-cat-btn ${activeCategory === 'All' && tab === 'menu' ? 'active' : ''}`}
          onClick={() => {
            setActiveCategory('All');
            setTab('menu');
          }}
        >
          <span>All Dishes</span>
        </button>
        {menuCategories.map(cat => {
          const isActive = activeCategory === cat.name && tab === 'menu';
          return (
            <button
              key={cat.name}
              type="button"
              className={`brix-mobile-cat-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory(isActive ? 'All' : cat.name);
                setTab('menu');
              }}
            >
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* ===================== RIGHT CONTENT AREA (WARM CREAM CANVAS ~79%) ===================== */}
      <main className="brix-content-canvas">
        {/* Canvas Top Bar: 4 Tabs + Rating + VIP Auth */}
        <div className="brix-canvas-top-bar">
          <nav className="brix-tab-navigation-group" aria-label="Customer Navigation">
            <button
              type="button"
              className={`brix-tab-pill-btn ${tab === 'menu' ? 'active' : ''}`}
              onClick={() => setTab('menu')}
            >
              <Coffee size={13} />
              <span>Explore Menu</span>
            </button>

            {placed && (
              <button
                type="button"
                className={`brix-tab-pill-btn ${tab === 'tracker' ? 'active' : ''}`}
                onClick={() => setTab('tracker')}
              >
                <Clock size={13} />
                <span>Track Order</span>
                <span style={{
                  fontSize: 9,
                  padding: '1px 6px',
                  borderRadius: 999,
                  fontWeight: 700,
                  background: placed.status === 'completed' ? '#7C896C' : 'var(--brix-badge-lime, #CEE338)',
                  color: placed.status === 'completed' ? '#fff' : '#1E2B10'
                }}>
                  {placed.status === 'completed' ? 'Fulfilled' : 'Live'}
                </span>
              </button>
            )}

            <button
              type="button"
              className={`brix-tab-pill-btn ${tab === 'book' ? 'active' : ''}`}
              onClick={() => setTab('book')}
            >
              <CalendarDays size={13} />
              <span>Book a Table</span>
            </button>

            <button
              type="button"
              className={`brix-tab-pill-btn ${tab === 'loyalty' ? 'active' : ''}`}
              onClick={() => setTab('loyalty')}
            >
              <Gift size={13} />
              <span>My Rewards</span>
            </button>

            <button
              type="button"
              className={`brix-tab-pill-btn ${tab === 'history' ? 'active' : ''}`}
              onClick={() => setTab('history')}
            >
              <History size={13} />
              <span>My Activity</span>
            </button>
          </nav>

          <div className="brix-canvas-meta-actions">
            <a
              href={googleReviewLink}
              target="_blank"
              rel="noreferrer"
              className="brix-canvas-pill-link"
              title="Google Rating 4.9 (350+ reviews)"
            >
              <Star size={12} fill="#eab308" color="#eab308" />
              <span><b>4.9</b> (350+)</span>
              <ExternalLink size={10} />
            </a>

            {customerAuth ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  className="brix-vip-auth-pill"
                  onClick={() => setTab('history')}
                  title="View VIP Passport & Activity"
                >
                  <ShieldCheck size={13} style={{ color: 'var(--brix-olive-dark)' }} />
                  <span>{customerAuth.name || 'VIP Member'}</span>
                  <span className="brix-vip-tag-gold">VIP</span>
                </button>
                <button
                  type="button"
                  className="brix-customer-logout-pill"
                  onClick={handleLogoutCustomer}
                  title="Log out of customer account"
                >
                  <LogOut size={12} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="brix-vip-auth-pill brix-vip-login-pill"
                onClick={() => openOtpModalForPhone()}
                title="Customer Login / Sign In with phone"
              >
                <User size={13} />
                <span>Customer Login</span>
              </button>
            )}
          </div>
        </div>

        {/* Toast Notice */}
        {notice && (
          <div className="customer-toast" onClick={() => setNotice('')}>
            <span>{notice}</span>
            <X size={16} />
          </div>
        )}

        {/* Live Order Tracker (When on tracker tab) */}
        {/* ===================== LIVE REAL-TIME ORDER TRACKING STEPPER ===================== */}
      {tab === 'tracker' && placed && (() => {
        const stageIndex =
          placed.status === 'completed'
            ? 3
            : placed.status === 'ready'
            ? 2
            : placed.status === 'preparing'
            ? 1
            : 0;

        const steps = [
          { key: 'placed', label: 'Placed', sub: 'Order confirmed', icon: Clock },
          { key: 'preparing', label: 'In Kitchen', sub: 'Crafting fresh', icon: ChefHat },
          { key: 'ready', label: 'Ready', sub: 'Ready for service', icon: Bell },
          { key: 'completed', label: 'Fulfilled', sub: 'Served & enjoy', icon: CheckCircle2 },
        ];

        return (
          <main className="customer-main-narrow">
            <div className="order-tracker-card">
              {/* Tracker Top Bar */}
              <div className="tracker-top-bar">
                <div className="tracker-live-pill">
                  <span className="tracker-live-dot"></span>
                  <span>LIVE KITCHEN SYNC</span>
                </div>
                <button
                  type="button"
                  className="tracker-refresh-btn"
                  onClick={refreshOrderStatus}
                  disabled={orderSyncing}
                  title="Force re-sync status"
                >
                  <RefreshCw size={13} className={orderSyncing ? 'spin-icon' : ''} />
                  <span>{orderSyncing ? 'Syncing…' : 'Sync'}</span>
                </button>
              </div>

              {/* Status Header Eyebrow */}
              <div className="tracker-header-box">
                <div className="tracker-order-chip">
                  <span>ORDER #{placed.orderNo}</span>
                </div>
                <h2 className="tracker-headline">
                  {stageIndex === 3
                    ? 'Order Served & Fulfilled!'
                    : stageIndex === 2
                    ? 'Your Order is Ready!'
                    : stageIndex === 1
                    ? 'Kitchen is Crafting Your Order'
                    : 'Order Confirmed & Queued'}
                </h2>
                <p className="tracker-subtext">
                  {stageIndex === 3
                    ? 'Thank you for choosing Gusstora. We hope you love your artisan brew!'
                    : stageIndex === 2
                    ? placed.table?.toLowerCase().includes('takeaway')
                      ? 'Please collect your items at the front counter pickup zone.'
                      : `Our barista/server is bringing your order to Table #${placed.table || '1'}.`
                    : stageIndex === 1
                    ? 'Our baristas and chefs are handcrafting your selections with precision.'
                    : 'Your order was sent directly to our kitchen display and is in queue.'}
                </p>
              </div>

              {/* 4-Stage Stepper Track */}
              <div className="stepper-track-wrap">
                <div className="stepper-track-line-bg">
                  <div
                    className="stepper-track-line-fill"
                    style={{ width: `${(stageIndex / (steps.length - 1)) * 100}%` }}
                  ></div>
                </div>

                <div className="stepper-nodes-row">
                  {steps.map((step, idx) => {
                    const StepIcon = step.icon;
                    const isDone = idx < stageIndex;
                    const isCurrent = idx === stageIndex;

                    return (
                      <div
                        key={step.key}
                        className={`stepper-node ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                      >
                        <div className="stepper-bubble">
                          {isDone ? (
                            <Check size={16} strokeWidth={3} />
                          ) : (
                            <StepIcon size={16} />
                          )}
                          {isCurrent && <span className="stepper-bubble-pulse"></span>}
                        </div>
                        <span className="stepper-node-title">{step.label}</span>
                        <span className="stepper-node-sub">{step.sub}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Info & Live Items Breakdown */}
              <div className="tracker-details-card">
                <div className="tracker-details-summary">
                  <div className="tracker-summary-item">
                    <span className="summary-label">Table / Type</span>
                    <strong className="summary-value">
                      {placed.table?.toLowerCase().includes('takeaway')
                        ? 'Takeaway Counter'
                        : `Table #${placed.table || '1'}`}
                    </strong>
                  </div>
                  <div className="tracker-summary-item">
                    <span className="summary-label">Payment</span>
                    <div className="summary-value" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                      <span className={`status-pill payment ${placed.paymentStatus === 'paid' ? 'paid' : 'pending'}`}>
                        {placed.paymentStatus === 'paid'
                          ? `✓ PAID (${(placed.paymentMethod || 'ONLINE').toUpperCase()})`
                          : placed.paymentMethod === 'cash'
                            ? 'CASH AT COUNTER'
                            : `${(placed.paymentMethod || 'ONLINE').toUpperCase()} PENDING`}
                      </span>
                      {placed.paymentStatus !== 'paid' && (
                        <button
                          type="button"
                          className="theme-btn-primary sm"
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => openPaymentGatewayModal(placed, placed.paymentMethod === 'cash' ? 'upi' : (placed.paymentMethod || 'upi'))}
                        >
                          <CreditCard size={12} />
                          <span>Pay {money(placed.total)} Online</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="tracker-summary-item">
                    <span className="summary-label">Total Amount</span>
                    <strong className="summary-value highlight">{money(placed.total)}</strong>
                  </div>
                </div>

                {/* Items Preparation Checklist */}
                {Array.isArray(placed.items) && placed.items.length > 0 && (
                  <div className="tracker-items-section">
                    <div className="tracker-items-header">
                      <span>Order Items ({placed.items.length})</span>
                      <span className="tracker-items-sub">Kitchen preparation status</span>
                    </div>
                    <div className="tracker-items-list">
                      {placed.items.map((it, i) => (
                        <div key={i} className={`tracker-item-row ${it.isCompleted ? 'item-ready' : ''}`}>
                          <div className="tracker-item-left">
                            <span className={`tracker-item-badge ${it.isCompleted ? 'done' : ''}`}>
                              {it.isCompleted ? <Check size={12} strokeWidth={3} /> : `${it.quantity}×`}
                            </span>
                            <div className="tracker-item-meta-wrap">
                              <div className="tracker-item-main-title">
                                <span className="tracker-item-name">{it.name}</span>
                                {it.selectedVariant && (
                                  <span className="tracker-item-variant"> · {it.selectedVariant.name}</span>
                                )}
                              </div>
                              {Array.isArray(it.selectedModifiers) && it.selectedModifiers.length > 0 && (
                                <div className="tracker-item-mods-chips">
                                  {it.selectedModifiers.map((m, idx) => (
                                    <span key={idx} className="tracker-item-mod-pill">+{m.name}</span>
                                  ))}
                                </div>
                              )}
                              {it.notes && (
                                <div className="tracker-item-note-text">
                                  <span>Note: "{it.notes}"</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="tracker-item-status-pill">
                            {it.isCompleted ? 'Prepared' : 'In prep…'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ===================== PHASE 7: DINER FEEDBACK & REVIEW BOOSTER ===================== */}
              <div className="diner-feedback-card">
                <div className="diner-feedback-head">
                  <div className="diner-feedback-title-row">
                    <Sparkles size={18} className="text-gold" />
                    <h4>How is your Gusstora experience?</h4>
                  </div>
                  <p className="diner-feedback-sub">
                    Your direct review helps fellow coffee enthusiasts discover us, and ensures our craft stays exceptional.
                  </p>
                </div>

                {/* 1 to 5 Star Rating Row */}
                <div className="star-rating-selector-wrap">
                  <div className="star-rating-buttons">
                    {[1, 2, 3, 4, 5].map(star => {
                      const isActive = (hoverRating || orderRating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          className={`star-select-btn ${isActive ? 'active' : ''}`}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => {
                            setOrderRating(star);
                            setFeedbackSubmitted(false);
                          }}
                          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                        >
                          <Star
                            size={28}
                            className="star-icon"
                            fill={isActive ? '#f59e0b' : 'none'}
                            stroke={isActive ? '#f59e0b' : 'var(--text-subtle, #a89f91)'}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <span className={`rating-verdict-label ${orderRating >= 4 ? 'positive' : orderRating > 0 ? 'critical' : ''}`}>
                    {orderRating === 5
                      ? '5/5 — Exceptional! Pure coffee bliss.'
                      : orderRating === 4
                      ? '4/5 — Very Good! Great brew & service.'
                      : orderRating === 3
                      ? '3/5 — Good. A few things could be better.'
                      : orderRating === 2
                      ? '2/5 — Fair. Did not meet expectations.'
                      : orderRating === 1
                      ? '1/5 — Poor. Needs urgent attention.'
                      : 'Tap a star to rate your visit'}
                  </span>
                </div>

                {/* Feedback Submitted View */}
                {feedbackSubmitted && existingOrderFeedback ? (
                  <div className="feedback-thankyou-box">
                    <div className="thankyou-badge">
                      {existingOrderFeedback.rating >= 4 ? (
                        <CheckCircle2 size={24} className="text-emerald" />
                      ) : (
                        <ShieldCheck size={24} className="text-terracotta" />
                      )}
                    </div>
                    <h5>
                      {existingOrderFeedback.rating >= 4
                        ? 'Thank You For Celebrating Our Roastery!'
                        : 'Your Feedback Is Under Private Review'}
                    </h5>
                    <p>
                      {existingOrderFeedback.rating >= 4
                        ? 'Your rating has been recorded. If you haven’t yet, please copy your compliment to our Google Maps page!'
                        : 'Our café owner and management have received your note directly to resolve this experience.'}
                    </p>

                    {existingOrderFeedback.rating >= 4 && (
                      <div className="google-booster-direct-action">
                        <a
                          href={googleReviewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="theme-btn-google-boost"
                        >
                          <Star size={16} fill="#fff" />
                          <span>Post on Google Reviews</span>
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    )}

                    <button
                      type="button"
                      className="edit-feedback-btn"
                      onClick={() => setFeedbackSubmitted(false)}
                    >
                      Update or add more details
                    </button>
                  </div>
                ) : orderRating >= 4 ? (
                  /* Positive Sentiment: GOOGLE REVIEW BOOSTER */
                  <div className="booster-positive-flow">
                    <div className="booster-banner">
                      <div className="booster-banner-icon">⭐</div>
                      <div className="booster-banner-text">
                        <strong>Google Review Booster Active</strong>
                        <p>Love our coffee? Select a compliment chip below to copy it instantly and share on Google!</p>
                      </div>
                    </div>

                    {/* Aspect Chips */}
                    <div className="aspects-selection-cluster">
                      <label className="aspects-label">What did you love most?</label>
                      <div className="aspect-chips-grid">
                        {positiveAspectsList.map(aspect => (
                          <button
                            key={aspect}
                            type="button"
                            className={`aspect-chip ${selectedAspects.includes(aspect) ? 'selected' : ''}`}
                            onClick={() => toggleFeedbackAspect(aspect)}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              {getAspectIcon(aspect)}
                              {aspect}
                            </span>
                            {selectedAspects.includes(aspect) && <Check size={12} strokeWidth={3} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 1-Click Compliment Generator */}
                    <div className="compliment-generator-section">
                      <div className="compliment-head">
                        <Sparkles size={14} className="text-gold" />
                        <span>1-Click Review Generator (Tap to copy)</span>
                      </div>
                      <div className="compliment-chips-scroll">
                        {presetCompliments.map((comp, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="compliment-preset-btn"
                            onClick={() => handleSelectCompliment(comp)}
                            title="Click to use & copy to clipboard"
                          >
                            <Copy size={12} />
                            <span>"{comp}"</span>
                          </button>
                        ))}
                      </div>
                      {copiedCompliment && (
                        <div className="copied-pill-toast">
                          <CheckCheck size={13} />
                          <span>Copied to clipboard! Ready to paste into Google Reviews.</span>
                        </div>
                      )}
                    </div>

                    {/* Comment text area */}
                    <div className="feedback-textarea-box">
                      <textarea
                        rows={3}
                        value={feedbackComment}
                        onChange={e => setFeedbackComment(e.target.value)}
                        placeholder="Add your own comments or barista shoutout (optional)..."
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="booster-actions-row">
                      <a
                        href={googleReviewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="theme-btn-google-boost"
                      >
                        <Star size={16} fill="#fff" />
                        <span>Copy & Post to Google Maps</span>
                        <ExternalLink size={14} />
                      </a>

                      <button
                        type="button"
                        className="theme-btn-primary sm"
                        onClick={() => handleSubmitFeedback(placed)}
                        disabled={submittingFeedback}
                      >
                        {submittingFeedback ? 'Saving…' : 'Submit Review'}
                      </button>
                    </div>

                    <div className="social-secondary-links">
                      <a
                        href={instagramLink}
                        target="_blank"
                        rel="noreferrer"
                        className="social-subtle-link"
                      >
                        <InstagramIcon size={14} />
                        <span>Tag @gusstora.cafe on Instagram</span>
                      </a>
                    </div>
                  </div>
                ) : orderRating > 0 ? (
                  /* Critical Sentiment: PRIVATE MANAGEMENT INTERCEPTION */
                  <div className="booster-critical-flow">
                    <div className="private-intercept-banner">
                      <div className="intercept-shield-icon">
                        <ShieldCheck size={20} />
                      </div>
                      <div className="intercept-banner-text">
                        <strong>Private Care Channel to Management</strong>
                        <p>
                          We apologize that your experience fell short. Your feedback is sent directly to cafe ownership
                          so we can fix this immediately, and is not published on public boards.
                        </p>
                      </div>
                    </div>

                    {/* Critical Aspect Tags */}
                    <div className="aspects-selection-cluster">
                      <label className="aspects-label">What areas need our immediate attention?</label>
                      <div className="aspect-chips-grid critical">
                        {criticalAspectsList.map(aspect => (
                          <button
                            key={aspect}
                            type="button"
                            className={`aspect-chip critical ${selectedAspects.includes(aspect) ? 'selected' : ''}`}
                            onClick={() => toggleFeedbackAspect(aspect)}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              {getAspectIcon(aspect)}
                              {aspect}
                            </span>
                            {selectedAspects.includes(aspect) && <Check size={12} strokeWidth={3} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Issue Comment */}
                    <div className="feedback-textarea-box">
                      <textarea
                        rows={3}
                        value={feedbackComment}
                        onChange={e => setFeedbackComment(e.target.value)}
                        placeholder="Please tell our management team what happened so we can make this right..."
                      />
                    </div>

                    <button
                      type="button"
                      className="theme-btn-private-feedback"
                      onClick={() => handleSubmitFeedback(placed)}
                      disabled={submittingFeedback}
                    >
                      <ShieldCheck size={16} />
                      <span>{submittingFeedback ? 'Sending Privately…' : 'Send Privately to Management'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="feedback-unselected-hint">
                    <p>Tap a star rating above to rate your drinks, food, and barista hospitality!</p>
                  </div>
                )}
              </div>

              {/* Navigation Action Buttons */}
              <div className="post-order-nav-btns">
                <button
                  type="button"
                  className="theme-btn-primary"
                  onClick={() => setTab('menu')}
                >
                  <span>Return to Menu</span>
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="theme-btn-secondary"
                  onClick={() => {
                    setTab('history');
                  }}
                >
                  <span>View in My Activity</span>
                  <History size={16} />
                </button>
                <button
                  type="button"
                  className="tracker-dismiss-link"
                  onClick={handleDismissTracker}
                >
                  Dismiss & Clear Tracker
                </button>
              </div>
            </div>
          </main>
        );
      })()}

        {/* TAB 1: MENU (AUTHENTIC BRIX EDITORIAL DESIGN) */}
        {tab === 'menu' && (
          <>
            {/* Live Kitchen Sync banner if an order is active */}
            {placed && placed.status !== 'completed' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                background: 'var(--brix-card-bg, #E8E1D6)',
                borderRadius: '12px',
                border: '1px solid var(--brix-border, #A5AA94)',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="tracker-live-dot" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brix-text-dark, #282820)' }}>
                    Order #{placed.orderNo} is {placed.status === 'ready' ? 'Ready for Pickup / Table Service!' : placed.status === 'preparing' ? 'Crafting in Kitchen' : 'Confirmed'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('tracker')}
                  style={{
                    background: 'var(--brix-primary, #46583B)',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Track Order ➔
                </button>
              </div>
            )}

            {/* Category Hero Header */}
            <div className="brix-category-hero-header">
              <h2 className="brix-editorial-category-title">
                {activeCategory === 'All' ? 'Drinks & Bites' : activeCategory}
              </h2>

              {/* Sub-filter Pills Row matching BRIX reference */}
              <div className="brix-subfilter-capsules-row">
                <div className="brix-capsules-cluster" role="tablist" aria-label="Dietary Sub-filters">
                  <button
                    type="button"
                    className={`brix-subfilter-capsule ${dietFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setDietFilter('all')}
                  >
                    <span>ALL</span>
                  </button>

                  <button
                    type="button"
                    className={`brix-subfilter-capsule ${dietFilter === 'veg' ? 'active' : ''}`}
                    onClick={() => setDietFilter(dietFilter === 'veg' ? 'all' : 'veg')}
                  >
                    <DietaryBadge isVeg={true} size={10} />
                    <span>PURE VEG</span>
                  </button>

                  <button
                    type="button"
                    className={`brix-subfilter-capsule ${dietFilter === 'non-veg' ? 'active' : ''}`}
                    onClick={() => setDietFilter(dietFilter === 'non-veg' ? 'all' : 'non-veg')}
                  >
                    <DietaryBadge isVeg={false} size={10} />
                    <span>NON-VEG</span>
                  </button>

                  <button
                    type="button"
                    className={`brix-subfilter-capsule ${dietFilter === 'bestseller' ? 'active' : ''}`}
                    onClick={() => setDietFilter(dietFilter === 'bestseller' ? 'all' : 'bestseller')}
                  >
                    <Sparkles size={10} />
                    <span>POPULAR</span>
                  </button>

                  <button
                    type="button"
                    className={`brix-subfilter-capsule ${dietFilter === 'gluten_free' ? 'active' : ''}`}
                    onClick={() => setDietFilter(dietFilter === 'gluten_free' ? 'all' : 'gluten_free')}
                  >
                    <span>GLUTEN-FREE</span>
                  </button>
                </div>

                {/* Compact Search & Sort Group */}
                <div className="brix-search-filter-mini-group">
                  <div className="brix-mini-search-wrap">
                    <Search size={13} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search brews, dishes..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="brix-mini-search-input"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
                        aria-label="Clear search"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>

                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="brix-mini-dropdown-btn"
                      onClick={() => {
                        setFaveSortDropdownOpen(prev => !prev);
                        setFaveTagsDropdownOpen(false);
                      }}
                    >
                      <span>Sort</span>
                      <ChevronDown size={11} />
                    </button>

                    {faveSortDropdownOpen && (
                      <div className="fave-popover-menu right" style={{ top: '100%', right: 0, marginTop: 4 }}>
                        <button
                          type="button"
                          className={`fave-popover-item ${faveSortBy === 'featured' ? 'active' : ''}`}
                          onClick={() => {
                            setFaveSortBy('featured');
                            setFaveSortDropdownOpen(false);
                          }}
                        >
                          <span>Recommended</span>
                          {faveSortBy === 'featured' && <Check size={12} />}
                        </button>
                        <button
                          type="button"
                          className={`fave-popover-item ${faveSortBy === 'price-asc' ? 'active' : ''}`}
                          onClick={() => {
                            setFaveSortBy('price-asc');
                            setFaveSortDropdownOpen(false);
                          }}
                        >
                          <span>Price: Low to High</span>
                          {faveSortBy === 'price-asc' && <Check size={12} />}
                        </button>
                        <button
                          type="button"
                          className={`fave-popover-item ${faveSortBy === 'price-desc' ? 'active' : ''}`}
                          onClick={() => {
                            setFaveSortBy('price-desc');
                            setFaveSortDropdownOpen(false);
                          }}
                        >
                          <span>Price: High to Low</span>
                          {faveSortBy === 'price-desc' && <Check size={12} />}
                        </button>
                      </div>
                    )}
                  </div>

                  {(activeCategory !== 'All' || dietFilter !== 'all' || searchQuery) && (
                    <button
                      type="button"
                      className="brix-reset-filters-btn"
                      onClick={() => {
                        setActiveCategory('All');
                        setDietFilter('all');
                        setSearchQuery('');
                      }}
                      title="Reset filters"
                    >
                      <X size={11} />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Section Heading & Thin Divider (Signatures) */}
            <div className="brix-section-editorial-rule-row">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <h3 className="brix-section-editorial-subhead">
                  {activeCategory === 'All' ? 'Signatures' : `${activeCategory} Selection`}
                </h3>
                <span style={{ fontSize: 11.5, color: 'var(--brix-text-secondary)', fontWeight: 500 }}>
                  {filteredMenu.length} {filteredMenu.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <hr className="brix-editorial-thin-rule" />
            </div>

            {/* 4-Column Compact Cards Grid */}
            {filteredMenu.length === 0 ? (
              <div className="brix-empty-state">
                <Coffee size={38} style={{ color: 'var(--brix-olive-medium)' }} />
                <h3>No Culinary Matches</h3>
                <p>We couldn't find items matching your search or filters.</p>
              </div>
            ) : (
              <div className="brix-products-grid-4col">
                {filteredMenu.map(item => {
                  const itemId = item._id || item.id;
                  const itemHasCustomizations = Boolean(
                    (Array.isArray(item.variants) && item.variants.length > 0) ||
                    (Array.isArray(item.modifierGroups) && item.modifierGroups.length > 0)
                  );
                  const inCartQty = getItemCartCount(itemId);
                  const itemImg = getFaveItemVisual(item);
                  const itemRecipe = getFaveItemRecipe(item);

                  const displayPrice = item.variants && item.variants.length > 0
                    ? `From ${money(Math.min(...item.variants.map(v => v.price)))}`
                    : money(item.price);

                  return (
                    <article className="brix-compact-card" key={itemId}>
                      <div
                        className="brix-card-img-container"
                        onClick={() => (itemHasCustomizations ? openCustomization(item) : openItemModal(item))}
                        title="Click to view details"
                      >
                        <img
                          src={itemImg}
                          alt={item.name}
                          loading="lazy"
                        />
                        {item.bestseller ? (
                          <span className="brix-lime-badge">SPECIAL</span>
                        ) : (item.price >= 240 || item.category === 'Coffee') ? (
                          <span className="brix-lime-badge">NEW</span>
                        ) : null}
                        <span className="brix-card-veg-indicator" title={item.veg ? 'Pure Veg' : 'Non-Veg'}>
                          <DietaryBadge isVeg={item.veg} size={10} />
                        </span>
                        {itemHasCustomizations && (
                          <span className="brix-card-custom-badge">CUSTOMISABLE</span>
                        )}
                      </div>

                      <div className="brix-card-info-box">
                        <h4
                          className="brix-card-dish-name"
                          onClick={() => (itemHasCustomizations ? openCustomization(item) : openItemModal(item))}
                          title={item.name}
                        >
                          {item.name}
                        </h4>

                        <p className="brix-card-dish-desc">
                          {itemRecipe || item.description}
                        </p>

                        <div className="brix-card-action-bar">
                          <span className="brix-card-dish-price">{displayPrice}</span>

                          {itemHasCustomizations ? (
                            <button
                              type="button"
                              className={`brix-customise-trigger-btn ${inCartQty > 0 ? 'has-qty' : ''}`}
                              onClick={() => openCustomization(item)}
                              aria-label={`Customise ${item.name}`}
                              title="Customise options"
                            >
                              {inCartQty > 0 && <span className="brix-customise-count-pill">{inCartQty}</span>}
                              <span>Customise</span>
                              <Plus size={11} strokeWidth={2.5} />
                            </button>
                          ) : inCartQty > 0 ? (
                            <div className="brix-card-mini-stepper" aria-label="Quantity Stepper">
                              <button
                                type="button"
                                onClick={() => {
                                  const matching = lines.filter(l => (l.menuItemId || l._id) === itemId);
                                  if (matching.length === 1) {
                                    updateCartQty(matching[0].cartKey, -1);
                                  } else {
                                    setCheckout(true);
                                  }
                                }}
                                aria-label="Decrease quantity"
                              >
                                <Minus size={11} />
                              </button>
                              <span>{inCartQty}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const matching = lines.filter(l => (l.menuItemId || l._id) === itemId);
                                  if (matching.length === 1) {
                                    updateCartQty(matching[0].cartKey, 1);
                                  } else {
                                    openItemModal(item);
                                  }
                                }}
                                aria-label="Increase quantity"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="brix-card-add-btn"
                              onClick={() => addStandardItem(item, 1)}
                              aria-label={`Add ${item.name} to order`}
                              title="Add to order"
                            >
                              <Plus size={13} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* TAB 2: BOOK A TABLE */}
        {/* ===================== TAB 2: BOOK A TABLE ===================== */}
      {tab === 'book' && (
        <main className="customer-main-narrow">
          <div className="booking-panel-box">
            <div className="panel-hero-head">
              <div className="panel-icon-wrap">
                <CalendarDays size={24} />
              </div>
              <div>
                <h2>Reserve a Table</h2>
                <p className="muted">
                  Enjoy our cozy atmosphere, handcrafted beverages, and private cafe dining.
                </p>
              </div>
            </div>

            <form onSubmit={book} className="theme-form-grid">
              <div className="form-group">
                <label>Your Name *</label>
                <input
                  required
                  placeholder="e.g. Akash Jha"
                  value={booking.name}
                  onChange={e => setBooking({ ...booking, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Mobile Number *</label>
                <input
                  required
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={booking.phone}
                  onChange={e => setBooking({ ...booking, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Guests</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={booking.guests}
                  onChange={e => setBooking({ ...booking, guests: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Reservation Date & Time *</label>
                <input
                  required
                  type="datetime-local"
                  value={booking.dateTime}
                  onChange={e => setBooking({ ...booking, dateTime: e.target.value })}
                />
              </div>

              <div className="form-group full-width">
                <label>Special Requests or Seating Preference</label>
                <textarea
                  rows="3"
                  placeholder="Window seat, anniversary, birthday celebration, or dietary preferences..."
                  value={booking.note}
                  onChange={e => setBooking({ ...booking, note: e.target.value })}
                />
              </div>

              <div className="form-actions-full">
                <button type="submit" className="theme-btn-primary full-width">
                  <span>Confirm Table Reservation</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </main>
      )}

        {/* TAB 3: LOYALTY & REWARDS */}
        {/* ===================== TAB 3: LOYALTY & REWARDS ===================== */}
      {tab === 'loyalty' && (
        <main className="customer-main-narrow">
          <div className="loyalty-card-dark">
            <div className="loyalty-watermark">Gusstora Club</div>
            <div className="loyalty-card-top">
              <div className="loyalty-brand-badge">
                <img src="/gusstora_emblem.png" alt="Gusstora" />
                <div>
                  <span className="brand-tier">GUSSTORA PRIVILEGE</span>
                  <h3>Stamp & Reward Passport</h3>
                </div>
              </div>
              <Gift size={28} className="loyalty-gift-icon" />
            </div>

            <div className="loyalty-rules-summary">
              <p>
                Collect <b>{cafe.loyalty.visitsRequired} visits</b> to unlock an instant reward worth up to{' '}
                <b>{money(cafe.loyalty.rewardCap)}</b>. Minimum spend of{' '}
                {money(cafe.loyalty.minimumSpend)} per eligible visit.
              </p>
            </div>

            {/* Customer Status Banner */}
            {customerAuth ? (
              <div className="customer-passport-verified-strip">
                <div className="strip-left">
                  <ShieldCheck size={18} className="text-gold" />
                  <div>
                    <b>{customerAuth.name}</b>
                    <span className="strip-phone">({customerAuth.phone})</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="strip-action-link"
                  onClick={() => setTab('history')}
                >
                  View Activity Timeline & Past Orders ↗
                </button>
              </div>
            ) : (
              <div className="loyalty-verify-cta-card">
                <div className="cta-left">
                  <Smartphone size={20} className="text-gold" />
                  <div>
                    <b>Secure Your Loyalty Passport</b>
                    <p className="cta-desc">Verify your phone with OTP to earn permanent visit stamps & redeem rewards.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="theme-btn-gold-sm"
                  onClick={() => openOtpModalForPhone(form.phone)}
                >
                  Verify OTP
                </button>
              </div>
            )}

            <div className="loyalty-search-input-box">
              <label>Lookup Your Stamp Card with Phone</label>
              <div className="input-with-button">
                <input
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
                <button type="button" onClick={() => lookupLoyalty(form.phone)}>
                  Check Card
                </button>
              </div>
            </div>

            {loyalty && (
              <div className="loyalty-stamp-progress-area">
                <div className="stamps-circles-grid">
                  {Array.from({ length: loyalty.required }, (_, i) => (
                    <div
                      className={`stamp-circle-slot ${i < loyalty.visits ? 'stamped' : ''}`}
                      key={i}
                    >
                      {i < loyalty.visits ? (
                        <Check size={20} strokeWidth={3} />
                      ) : (
                        <span className="slot-num">{i + 1}</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="stamp-progress-meta">
                  {loyalty.remaining > 0 ? (
                    <p className="stamps-needed-msg">
                      Only <b>{loyalty.remaining} more eligible visit{loyalty.remaining !== 1 ? 's' : ''}</b> until your next reward!
                    </p>
                  ) : (
                    <p className="stamps-congrats-msg" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Gift size={16} className="text-gold" /> Congratulations! You have unlocked your loyalty reward!
                    </p>
                  )}
                </div>

                {loyalty.rewards?.length > 0 && (
                  <div className="loyalty-rewards-cards-container">
                    <div className="rewards-unlocked-banner">
                      <Sparkles size={18} />
                      <span>
                        You have <b>{loyalty.rewards.length} reward{loyalty.rewards.length > 1 ? 's' : ''}</b> ready!
                      </span>
                    </div>

                    <div className="customer-voucher-cards-grid">
                      {loyalty.rewards.map(r => (
                        <div key={r._id || r.id} className={`customer-voucher-ticket ${r.status}`}>
                          <div className="voucher-ticket-header">
                            <span className="voucher-ticket-badge">VIP VOUCHER</span>
                            <span className={`voucher-status-pill ${r.status}`}>
                              {r.status === 'claimed' ? 'READY TO REDEEM' : 'UNLOCKED'}
                            </span>
                          </div>

                          <div className="voucher-ticket-body">
                            <h3 className="voucher-amount-display">{money(r.amount)} OFF</h3>
                            <p className="voucher-desc">Eligible for dining discount or free beverage</p>
                            {r.expiresAt && (
                              <span className="voucher-expiry-note">
                                Valid until {new Date(r.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            )}
                          </div>

                          <div className="voucher-ticket-footer">
                            {r.status === 'claimed' && r.claimCode ? (
                              <div className="claimed-code-display-box">
                                <span className="code-label">IN-STORE CLAIM CODE</span>
                                <div className="code-pill-flex">
                                  <span className="claim-code-text">{r.claimCode}</span>
                                  <button
                                    type="button"
                                    className="copy-claim-code-btn"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(r.claimCode);
                                      setNotice(`Copied code ${r.claimCode} to clipboard!`);
                                    }}
                                    title="Copy Code"
                                  >
                                    Copy
                                  </button>
                                  <button
                                    type="button"
                                    className="show-qr-mini-btn"
                                    onClick={() => setSelectedVoucherQr(r)}
                                  >
                                    <QrCode size={14} /> Show QR
                                  </button>
                                </div>
                                <small className="counter-hint">Show this code or QR to cashier at billing</small>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="theme-btn-claim-voucher"
                                onClick={() => handleClaimVoucher(r._id || r.id)}
                                disabled={claimingRewardId === (r._id || r.id)}
                              >
                                <Gift size={16} />
                                <span>{claimingRewardId === (r._id || r.id) ? 'Generating Pass…' : 'Claim In-Store Pass'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      )}

        {/* TAB 4: ORDER HISTORY & ACTIVITY */}
        {/* ===================== TAB 4: MY ACTIVITY & ORDER HISTORY ===================== */}
      {tab === 'history' && (
        <main className="customer-main-narrow">
          {!customerAuth ? (
            <div className="customer-guest-history-card">
              <div className="guest-history-icon-circle">
                <User size={32} />
              </div>
              <h2>Customer Activity & History</h2>
              <p className="guest-history-desc">
                Sign in with your mobile number via OTP to view your complete dining & takeaway history, active loyalty vouchers, and digital receipts.
              </p>
              <button
                className="theme-btn-primary"
                onClick={() => openOtpModalForPhone()}
              >
                <Smartphone size={17} />
                <span>Verify with Mobile OTP</span>
              </button>
            </div>
          ) : (
            <div className="customer-activity-container">
              {/* Profile Card */}
              <div className="customer-profile-card">
                <div className="profile-top-row">
                  <div className="profile-identity">
                    <div className="profile-avatar-box">
                      <img src="/gusstora_emblem.png" alt="Gusstora" />
                    </div>
                    <div>
                      <div className="profile-name-cluster">
                        <h3>{customerAuth.name || 'Valued Member'}</h3>
                        <span className="verified-shield-badge">
                          <CheckCircle2 size={13} />
                          Verified
                        </span>
                      </div>
                      <span className="profile-phone-text">{customerAuth.phone}</span>
                    </div>
                  </div>

                  <button
                    className="logout-mini-btn"
                    onClick={handleLogoutCustomer}
                    title="Switch Account / Sign Out"
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>

                <div className="profile-metrics-grid">
                  <div className="metric-box">
                    <span className="metric-label">Total Visits</span>
                    <span className="metric-val">{customerHistory?.customer?.totalVisits || loyalty?.visits || 0}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Stamps Earned</span>
                    <span className="metric-val text-gold">
                      {customerHistory?.customer?.stamps || loyalty?.visits || 0} / {cafe.loyalty?.visitsRequired || 5}
                    </span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Total Spent</span>
                    <span className="metric-val">{money(customerHistory?.customer?.totalSpend || 0)}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Active Rewards</span>
                    <span className="metric-val text-green">
                      {customerHistory?.rewards?.filter(r => r.status === 'unclaimed' || r.status === 'active').length || loyalty?.rewards?.length || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rewards List */}
              {customerHistory?.rewards?.length > 0 && (
                <div className="activity-section">
                  <h3 className="section-title">
                    <Gift size={18} />
                    <span>My Vouchers & Rewards</span>
                  </h3>
                  <div className="rewards-cards-stack">
                    {customerHistory.rewards.map(r => (
                      <div
                        key={r._id || r.id}
                        className={`voucher-card-item ${r.status === 'redeemed' ? 'redeemed' : 'active'}`}
                      >
                        <div className="voucher-left">
                          <div className="voucher-icon-badge">
                            <Sparkles size={16} />
                          </div>
                          <div>
                            <b>{money(r.amount)} Discount Voucher</b>
                            <span className="voucher-sub">
                              {r.status === 'redeemed'
                                ? `Redeemed ${r.redeemedAt ? new Date(r.redeemedAt).toLocaleDateString('en-IN') : ''} ${r.notes ? `(${r.notes})` : ''}`
                                : r.status === 'claimed' && r.claimCode
                                ? `Claim Code: ${r.claimCode} • Ready for in-store redemption`
                                : 'Available to claim or apply at checkout'}
                            </span>
                          </div>
                        </div>

                        <div className="voucher-right-actions">
                          {r.status === 'claimed' && r.claimCode && (
                            <button
                              type="button"
                              className="show-qr-mini-btn"
                              onClick={() => setSelectedVoucherQr(r)}
                            >
                              <QrCode size={13} /> QR Pass
                            </button>
                          )}
                          {r.status === 'available' && (
                            <button
                              type="button"
                              className="claim-mini-pill-btn"
                              onClick={() => handleClaimVoucher(r._id || r.id)}
                              disabled={claimingRewardId === (r._id || r.id)}
                            >
                              {claimingRewardId === (r._id || r.id) ? 'Claiming…' : 'Claim Pass'}
                            </button>
                          )}
                          <span className={`voucher-status-pill ${r.status}`}>
                            {r.status === 'redeemed' ? 'REDEEMED' : r.status === 'claimed' ? 'CLAIMED' : 'UNLOCKED'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past Orders Timeline */}
              <div className="activity-section">
                <div className="section-head-flex">
                  <h3 className="section-title">
                    <History size={18} />
                    <span>Past Orders & Visits</span>
                  </h3>
                  <button
                    className="refresh-mini-btn"
                    onClick={() => loadCustomerHistory(customerAuth.phone)}
                    disabled={historyLoading}
                  >
                    {historyLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>

                {historyLoading && !customerHistory?.orders ? (
                  <div className="history-loader-box">
                    <div className="loader-coffee-box mini">
                      <img src="/gusstora_emblem.png" alt="Loading" className="loader-logo-spin" />
                    </div>
                    <span>Loading your orders…</span>
                  </div>
                ) : customerHistory?.orders?.length > 0 ? (
                  <div className="customer-orders-timeline">
                    {customerHistory.orders.map(o => (
                      <div className="order-history-card" key={o._id}>
                        <div className="order-head-bar">
                          <div className="order-head-left">
                            <span className="order-num-pill">#{o.orderNo}</span>
                            <span className="order-date-text">
                              {new Date(o.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <span className={`order-status-badge ${o.status}`}>
                            {o.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="order-items-preview-list">
                          {o.items?.map((it, idx) => (
                            <div className="item-history-line" key={idx}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span>
                                  {it.quantity}x {it.name || 'Artisan Item'}
                                  {it.selectedVariant && (
                                    <span style={{ fontSize: 11, color: 'var(--brix-olive-medium)', fontWeight: 700, marginLeft: 5 }}>
                                      ({it.selectedVariant.name})
                                    </span>
                                  )}
                                </span>
                                {it.notes && (
                                  <div style={{ fontSize: 11, color: '#b45309', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <MessageSquare size={10} />
                                    <span>Note: "{it.notes}"</span>
                                  </div>
                                )}
                              </div>
                              <b>{money(it.price * it.quantity)}</b>
                            </div>
                          ))}
                        </div>

                        <div className="order-footer-bar">
                          <div className="order-meta-info">
                            <span>{o.table ? `Table #${o.table}` : 'Takeaway'}</span>
                            <span className="dot-sep">•</span>
                            <span>{o.paymentStatus === 'paid' ? 'Paid Online' : 'Pay at Counter'}</span>
                          </div>
                          <div className="order-total-amount">
                            <span>Total:</span>
                            <b>{money(o.total)}</b>
                          </div>
                        </div>

                        {/* Order Feedback Status / Action */}
                        <div className="order-history-feedback-row">
                          {o.Feedback ? (
                            <div className="order-history-rating-pill">
                              <Star size={13} fill="#f59e0b" color="#f59e0b" />
                              <span>Rated {o.Feedback.rating}/5</span>
                              <span className={`feedback-sentiment-tag ${o.Feedback.sentiment}`}>
                                {o.Feedback.sentiment === 'positive' ? 'Google Booster' : 'Private Care'}
                              </span>
                            </div>
                          ) : o.status === 'completed' ? (
                            <button
                              type="button"
                              className="rate-history-order-btn"
                              onClick={() => openRatingModalForOrder(o)}
                            >
                              <Star size={13} />
                              <span>Rate Order & Share Feedback</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-history-box">
                    <Coffee size={28} className="muted" />
                    <p>No past orders recorded under this phone number yet.</p>
                    <button
                      className="theme-btn-primary sm"
                      onClick={() => setTab('menu')}
                    >
                      Browse Today's Menu
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      )}
      </main>

      {/* QR Code Modal */}
      {faveQrModalOpen && (
        <div className="fave-modal-backdrop" onClick={() => setFaveQrModalOpen(false)}>
          <div className="fave-modal-card" onClick={e => e.stopPropagation()}>
            <div className="fave-modal-header">
              <h3 className="fave-modal-title">Table QR Code</h3>
              <button
                type="button"
                className="fave-modal-close-btn"
                onClick={() => setFaveQrModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ background: '#ffffff', padding: 20, borderRadius: 20, display: 'inline-block', border: '1px solid #eadbce', boxShadow: '0 8px 24px rgba(26, 18, 12, 0.06)' }}>
                <QRCodeSVG
                  value={`${window.location.origin}/cafe/${slug}${form.table ? `?table=${form.table}` : ''}`}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <h4 style={{ margin: '16px 0 6px 0', fontSize: 18, color: '#1a120c', fontFamily: 'var(--font-heading)' }}>
                {cafe.name || 'The Daily Grind'} · Table #{form.table || '1'}
              </h4>
              <p style={{ color: '#635347', fontSize: 13, margin: '0 0 20px 0' }}>
                Scan with any mobile camera to order and collect loyalty stamps instantly.
              </p>
              <button
                type="button"
                className="fave-pill-btn-manage"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/cafe/${slug}${form.table ? `?table=${form.table}` : ''}`);
                  setFaveCopiedLink(true);
                  setTimeout(() => setFaveCopiedLink(false), 2000);
                }}
              >
                {faveCopiedLink ? <Check size={15} /> : <Copy size={15} />}
                <span>{faveCopiedLink ? 'Menu Link Copied!' : 'Copy Table Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Table Modal */}
      {faveManageModalOpen && (
        <div className="fave-modal-backdrop" onClick={() => setFaveManageModalOpen(false)}>
          <div className="fave-modal-card" onClick={e => e.stopPropagation()}>
            <div className="fave-modal-header">
              <h3 className="fave-modal-title">Manage Dining & Order</h3>
              <button
                type="button"
                className="fave-modal-close-btn"
                onClick={() => setFaveManageModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#635347', display: 'block', marginBottom: 6 }}>
                  Seated Table Number
                </label>
                <input
                  type="text"
                  className="fave-search-pill-input"
                  style={{ width: '100%', padding: '10px 16px' }}
                  value={form.table}
                  onChange={e => setForm({ ...form, table: e.target.value })}
                  placeholder="e.g. 4 or Takeaway"
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#635347', display: 'block', marginBottom: 6 }}>
                  Diner Name (Optional)
                </label>
                <input
                  type="text"
                  className="fave-search-pill-input"
                  style={{ width: '100%', padding: '10px 16px' }}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name for kitchen callout"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="fave-pill-btn-manage"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    setFaveManageModalOpen(false);
                    setTab('history');
                  }}
                >
                  <History size={14} />
                  <span>Past Orders</span>
                </button>
                <button
                  type="button"
                  className="fave-pill-btn-soft"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    setFaveManageModalOpen(false);
                    setTab('book');
                  }}
                >
                  <CalendarDays size={14} />
                  <span>Reserve Table</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {faveSettingsModalOpen && (
        <div className="fave-modal-backdrop" onClick={() => setFaveSettingsModalOpen(false)}>
          <div className="fave-modal-card" onClick={e => e.stopPropagation()}>
            <div className="fave-modal-header">
              <h3 className="fave-modal-title">Venue & Preferences</h3>
              <button
                type="button"
                className="fave-modal-close-btn"
                onClick={() => setFaveSettingsModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ background: '#F2EDE4', padding: 14, borderRadius: 14, border: '1px solid #A5AA94' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#282820' }}>Free Guest Wi-Fi</span>
                  <button
                    type="button"
                    onClick={copyWifi}
                    style={{ background: 'none', border: 'none', color: '#46583B', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >
                    {copiedWifi ? 'Copied!' : 'Copy Password'}
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#777B6B' }}>
                  SSID: <b>{cafe.wifiSsid || 'Gusstora-Guest-5G'}</b>
                </p>
              </div>

              <div style={{ background: '#F2EDE4', padding: 14, borderRadius: 14, border: '1px solid #A5AA94' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#282820', display: 'block', marginBottom: 4 }}>
                  Operating Hours
                </span>
                <p style={{ margin: 0, fontSize: 13, color: '#777B6B' }}>
                  Daily: 8:00 AM – 11:00 PM · Fresh kitchen closes at 10:30 PM
                </p>
              </div>

              <button
                type="button"
                className="fave-pill-btn-manage"
                style={{ justifyContent: 'center', marginTop: 8 }}
                onClick={() => setFaveSettingsModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== FLOATING CART BAR ===================== */}
      {totalItemCount > 0 && !checkout && !placed && (
        <div className="floating-cart-wrapper">
          <button className="floating-cart-bar" onClick={() => setCheckout(true)}>
            <div className="cart-left-info">
              <div className="cart-icon-circle">
                <ShoppingBag size={18} />
                <span className="cart-counter-badge">{totalItemCount}</span>
              </div>
              <div className="cart-total-text">
                <span className="cart-label">{totalItemCount} item{totalItemCount > 1 ? 's' : ''} added</span>
                <span className="cart-amount">{money(total)}</span>
              </div>
            </div>

            <div className="cart-right-action">
              <span>View Cart & Checkout</span>
              <ChevronRight size={18} />
            </div>
          </button>
        </div>
      )}

      {/* ===================== ARTISAN MODIFIER & VARIANT CUSTOMIZATION SHEET ===================== */}
      {customizingItem && (() => {
        const item = customizingItem;
        const profile = getItemAromaProfile(item);
        const itemImg = getFaveItemVisual(item);

        return (
          <div className="customizer-modal-backdrop" onClick={() => setCustomizingItem(null)}>
            <div className="customizer-modal-card" onClick={e => e.stopPropagation()}>
              <div className="customizer-header-bar">
                <div className="customizer-item-brief">
                  <span className="customizer-cat-tag">{item.category}</span>
                  <h3 className="customizer-title">{item.name}</h3>
                </div>
                <button
                  type="button"
                  className="customizer-close-btn"
                  onClick={() => setCustomizingItem(null)}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="customizer-scroll-body">
                {/* Visual Header */}
                <div className="customizer-hero-banner">
                  <img
                    className="customizer-hero-image-backdrop"
                    src={itemImg}
                    alt=""
                    aria-hidden="true"
                  />
                  <img className="customizer-hero-image" src={itemImg} alt={item.name} />
                  <div className="customizer-hero-overlay">
                    <span className={`dietary-badge ${item.veg ? 'veg' : 'non-veg'}`}>
                      <span className="diet-dot"></span>
                      {item.veg ? 'Pure Veg' : 'Non-Veg'}
                    </span>
                    <span className="spotlight-gold-badge">
                      <Sparkles size={11} /> {profile.badge || 'Craft Recipe'}
                    </span>
                  </div>
                </div>

                {item.description && (
                  <p className="customizer-desc">{item.description}</p>
                )}

                {/* 1. Size / Variant Selector */}
                {Array.isArray(item.variants) && item.variants.length > 0 && (
                  <div className="customizer-section">
                    <div className="customizer-section-title-row">
                      <div>
                        <h4 className="customizer-section-title">Select Size / Portion</h4>
                        <span className="customizer-section-hint">Required · Choose 1</span>
                      </div>
                      <span className="customizer-req-badge">Mandatory</span>
                    </div>

                    <div className="customizer-variant-grid">
                      {item.variants.map(v => {
                        const isSelected = customVariant?.id === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            className={`customizer-variant-btn ${isSelected ? 'active' : ''}`}
                            onClick={() => setCustomVariant(v)}
                          >
                            <div className="customizer-variant-radio">
                              {isSelected && <div className="customizer-radio-inner" />}
                            </div>
                            <div className="customizer-variant-info">
                              <span className="customizer-variant-name">{v.name}</span>
                              <span className="customizer-variant-price">{money(v.price)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Dynamic Modifier Groups */}
                {Array.isArray(item.modifierGroups) && item.modifierGroups.map(group => {
                  const isSingleSelect = group.maxSelect === 1;

                  return (
                    <div className="customizer-section" key={group.id}>
                      <div className="customizer-section-title-row">
                        <div>
                          <h4 className="customizer-section-title">{group.name}</h4>
                          <span className="customizer-section-hint">
                            {group.required
                              ? isSingleSelect ? 'Required · Pick 1' : `Required · Pick min ${group.minSelect || 1}`
                              : isSingleSelect ? 'Optional · Choose 1' : `Optional · Up to ${group.maxSelect || 5}`}
                          </span>
                        </div>
                        {group.required && (
                          <span className="customizer-req-badge">Required</span>
                        )}
                      </div>

                      <div className="customizer-options-list">
                        {(group.options || []).map(opt => {
                          const isOptionSelected = (customModifiers || []).some(m => m.id === opt.id);
                          const optPrice = Number(opt.price || 0);

                          return (
                            <div
                              key={opt.id}
                              className={`customizer-option-row ${isOptionSelected ? 'selected' : ''}`}
                              onClick={() => toggleCustomModifier(group, opt)}
                            >
                              <div className="customizer-option-left">
                                <div className={`customizer-check-circle ${isSingleSelect ? 'radio' : 'checkbox'} ${isOptionSelected ? 'active' : ''}`}>
                                  {isOptionSelected && (
                                    isSingleSelect ? <div className="customizer-radio-inner" /> : <Check size={12} strokeWidth={3} />
                                  )}
                                </div>
                                <span className="customizer-option-name">{opt.name}</span>
                              </div>
                              <span className="customizer-option-price">
                                {optPrice > 0 ? `+${money(optPrice)}` : 'Free'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* 3. Special Instructions */}
                <div className="customizer-section">
                  <div className="customizer-section-title-row">
                    <div>
                      <h4 className="customizer-section-title">Special Instructions</h4>
                      <span className="customizer-section-hint">Specific temperature, sweetness, ice level...</span>
                    </div>
                  </div>
                  <div className="customizer-input-wrap">
                    <MessageSquare size={15} className="customizer-input-icon" />
                    <input
                      type="text"
                      maxLength={150}
                      className="customizer-notes-input"
                      placeholder="e.g. Extra hot, oat milk on side, less sweet..."
                      value={customNotes}
                      onChange={e => setCustomNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Sticky Action Bar */}
              <div className="customizer-footer-bar">
                <div className="customizer-qty-picker">
                  <button
                    type="button"
                    onClick={() => setCustomQty(q => Math.max(1, q - 1))}
                    disabled={customQty <= 1}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="customizer-qty-val">{customQty}</span>
                  <button
                    type="button"
                    onClick={() => setCustomQty(q => Math.min(20, q + 1))}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  className="customizer-submit-cta"
                  disabled={Boolean(missingRequiredGroup)}
                  onClick={commitCustomizedItem}
                >
                  <ShoppingBag size={17} />
                  <span>
                    {missingRequiredGroup
                      ? `Select ${missingRequiredGroup}`
                      : `Add to Order · ${money(modalTotalPrice)}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================== ITEM DETAIL & TASTING NOTES MODAL ===================== */}
      {selectedItemModal && (() => {
        const item = selectedItemModal;
        const profile = getItemAromaProfile(item);
        const inCartQty = getItemCartCount(item._id || item.id);
        return (
          <div className="item-detail-modal-backdrop" onClick={closeItemModal}>
            <div className="item-detail-modal-card" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className="item-modal-close-floating"
                onClick={closeItemModal}
                aria-label="Close"
              >
                <X size={18} />
              </button>

              <div className="item-modal-visual">
                {item.image ? (
                  <>
                    <img
                      className="item-modal-image-backdrop"
                      src={item.image}
                      alt=""
                      aria-hidden="true"
                    />
                    <img className="item-modal-image" src={item.image} alt={item.name} />
                  </>
                ) : (
                  <div className="item-modal-placeholder">
                    <Coffee size={48} />
                  </div>
                )}
                <div className="item-modal-visual-badges">
                  <span className={`dietary-badge ${item.veg ? 'veg' : 'non-veg'}`}>
                    <span className="diet-dot"></span>
                    {item.veg ? 'Pure Veg' : 'Non-Veg'}
                  </span>
                  <span className="spotlight-gold-badge">
                    <Sparkles size={11} /> {profile.badge}
                  </span>
                </div>
              </div>

              <div className="item-modal-content">
                <div className="item-modal-header-meta">
                  <span className="item-modal-cat">{item.category}</span>
                  <span className="item-modal-prep"><Clock size={12} /> {profile.prep}</span>
                </div>

                <h2 className="item-modal-title">{item.name}</h2>
                <div className="item-modal-aroma-box">
                  <span className="aroma-box-label"><Sparkles size={12} className="text-gold" /> Tasting & Sensory Notes:</span>
                  <p className="aroma-box-text">{profile.notes}</p>
                </div>

                <p className="item-modal-desc">{item.description}</p>

                {/* Special Instructions */}
                <div className="item-modal-notes-section">
                  <label className="item-modal-notes-label">
                    <MessageSquare size={13} />
                    <span>Special Instructions for Barista / Kitchen</span>
                  </label>
                  <input
                    type="text"
                    className="item-custom-note-input"
                    placeholder="e.g. oat milk, less sweet, extra hot, no cinnamon..."
                    value={itemCustomNote}
                    onChange={e => setItemCustomNote(e.target.value)}
                  />
                </div>

                <div className="item-modal-footer">
                  <div className="item-modal-price-col">
                    <span className="price-sub">Price</span>
                    <span className="price-main">{money(item.price * itemModalQty)}</span>
                    {inCartQty > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--brix-olive-medium)', fontWeight: 600, display: 'block', marginTop: 2 }}>
                        {inCartQty} in cart
                      </span>
                    )}
                  </div>

                  <div className="item-modal-cta-col">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="menu-stepper lg">
                        <button
                          type="button"
                          className="step-btn"
                          onClick={() => setItemModalQty(q => Math.max(1, q - 1))}
                          aria-label="Decrease quantity"
                          disabled={itemModalQty <= 1}
                        >
                          <Minus size={15} />
                        </button>
                        <span className="step-count">{itemModalQty}</span>
                        <button
                          type="button"
                          className="step-btn"
                          onClick={() => setItemModalQty(q => Math.min(20, q + 1))}
                          aria-label="Increase quantity"
                        >
                          <Plus size={15} />
                        </button>
                      </div>

                      <button
                        type="button"
                        className="theme-btn-primary add-modal-btn"
                        onClick={() => {
                          addStandardItem(item, itemModalQty, itemCustomNote);
                          closeItemModal();
                        }}
                      >
                        <ShoppingBag size={16} />
                        <span>Add to Order · {money(item.price * itemModalQty)}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================== CHECKOUT MODAL ===================== */}
      {checkout && (
        <div className="checkout-modal-backdrop" onClick={() => setCheckout(false)}>
          <div className="checkout-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-tag">YOUR ORDER SUMMARY</span>
                <h3 className="modal-title">Review & Place Order</h3>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setCheckout(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Line Items */}
            <div className="modal-items-scroll">
              {lines.map(line => (
                <div className="modal-cart-item" key={line.cartKey || line._id}>
                  <div className="item-meta">
                    <div className="item-meta-title-row">
                      <b>{line.name}</b>
                      {line.selectedVariant && (
                        <span className="cart-variant-tag">{line.selectedVariant.name}</span>
                      )}
                    </div>
                    {Array.isArray(line.selectedModifiers) && line.selectedModifiers.length > 0 && (
                      <div className="cart-modifiers-line">
                        {line.selectedModifiers.map((m, idx) => (
                          <span key={idx} className="cart-mod-chip">
                            +{m.name} {m.price > 0 ? `(₹${m.price})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {line.notes && (
                      <div className="cart-notes-callout">
                        <MessageSquare size={11} />
                        <span>"{line.notes}"</span>
                      </div>
                    )}
                    <span className="item-single-price">{money(line.unitPrice || line.price)} each</span>
                  </div>
                  <div className="modal-item-stepper">
                    <button onClick={() => updateCartQty(line.cartKey || line._id, -1)} aria-label="Subtract">
                      <Minus size={13} />
                    </button>
                    <span>{line.quantity}</span>
                    <button onClick={() => updateCartQty(line.cartKey || line._id, 1)} aria-label="Add">
                      <Plus size={13} />
                    </button>
                  </div>
                  <div className="item-subtotal">
                    <b>{money((line.unitPrice || line.price) * line.quantity)}</b>
                  </div>
                </div>
              ))}
            </div>

            {/* Smart Roastery AI Pairing / Upsell Suggestions (Phase 12) */}
            {upsellSuggestions.length > 0 && (
              <div style={{
                margin: '14px 0 6px',
                padding: '12px 14px',
                background: 'linear-gradient(135deg, rgba(70, 88, 59, 0.08), rgba(40, 51, 34, 0.04))',
                borderRadius: '14px',
                border: '1px solid rgba(70, 88, 59, 0.25)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} style={{ color: '#46583B' }} />
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#46583B' }}>
                      Frequently Paired With
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', background: 'rgba(70, 88, 59, 0.15)', color: '#46583B', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    AI Recommended
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {upsellSuggestions.slice(0, 2).map((sugg, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: '#fff',
                        borderRadius: '10px',
                        border: '1px solid #ebdcd3',
                        boxShadow: '0 1px 4px rgba(44,24,16,0.03)'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#2c1810', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sugg.suggestedItem.name}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#7a685f', marginTop: '2px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#46583B' }}>{money(sugg.comboPrice || sugg.suggestedItem.price)}</span>
                          {sugg.comboDiscount > 0 && (
                            <span style={{ textDecoration: 'line-through', color: '#a09088', fontSize: '10px' }}>
                              {money(sugg.suggestedItem.price)}
                            </span>
                          )}
                          <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>
                            {sugg.reason || 'Roastery Favorite'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => addStandardItem(sugg.suggestedItem, 1)}
                        style={{
                          padding: '6px 12px',
                          background: 'linear-gradient(135deg, #46583B, #36452E)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0,
                          boxShadow: '0 2px 6px rgba(70, 88, 59, 0.3)'
                        }}
                      >
                        <Plus size={12} />
                        Add {sugg.comboDiscount > 0 ? `(Save ₹${sugg.comboDiscount})` : ''}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Promo / Voucher Code Section */}
            <div className="cart-promo-section" style={{
              margin: '14px 0 10px',
              padding: '12px 14px',
              background: '#fff',
              borderRadius: '12px',
              border: appliedPromo ? '1.5px solid #10b981' : '1px solid #f0e6dc',
              boxShadow: '0 2px 6px rgba(44,24,16,0.04)'
            }}>
              {!appliedPromo ? (
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="text"
                        placeholder="Promo Code (e.g. WELCOME20)"
                        value={promoCodeInput}
                        onChange={e => {
                          setPromoCodeInput(e.target.value.toUpperCase());
                          if (promoError) setPromoError('');
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleApplyPromo();
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '9px 12px 9px 34px',
                          borderRadius: '8px',
                          border: '1px solid #d5c8be',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          boxSizing: 'border-box'
                        }}
                      />
                      <Tag size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8c7e75' }} />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={promoValidating || !promoCodeInput.trim()}
                      style={{
                        padding: '9px 16px',
                        background: '#46583B',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: promoValidating || !promoCodeInput.trim() ? 'not-allowed' : 'pointer',
                        opacity: promoValidating || !promoCodeInput.trim() ? 0.6 : 1,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {promoValidating ? 'Checking…' : 'Apply'}
                    </button>
                  </div>
                  {promoError && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={12} /> {promoError}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: '#ecfdf5',
                      color: '#047857',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '13px',
                      border: '1px solid #a7f3d0'
                    }}>
                      <Tag size={12} /> {appliedPromo.code}
                    </span>
                    <span style={{ fontSize: '12px', color: '#047857', fontWeight: 600 }}>
                      Saved {money(promoDiscountAmount)}!
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePromo}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      textDecoration: 'underline'
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Total Row */}
            <div className="modal-total-breakdown">
              <div className="total-row">
                <span>Subtotal</span>
                <span>{money(total)}</span>
              </div>
              {appliedPromo && (
                <div className="total-row" style={{ color: '#047857', fontWeight: 600 }}>
                  <span>Promo Discount ({appliedPromo.code})</span>
                  <span>- {money(promoDiscountAmount)}</span>
                </div>
              )}
              <div className="total-row grand-total">
                <span>Total Payable</span>
                <b>{money(finalPayable)}</b>
              </div>
            </div>

            {/* Checkout Form */}
            <form onSubmit={order} className="modal-checkout-form">
              <div className="theme-form-grid">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    required
                    placeholder="Enter your name"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <div className="label-with-action">
                    <label>Mobile Number *</label>
                    {!customerAuth && (
                      <button
                        type="button"
                        className="text-link-btn"
                        onClick={() => openOtpModalForPhone(form.phone)}
                      >
                        Verify OTP
                      </button>
                    )}
                  </div>
                  <input
                    required
                    type="tel"
                    placeholder="For order status & stamps"
                    value={form.phone}
                    onBlur={() => lookupLoyalty(form.phone)}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Table Number / Takeaway</label>
                  <input
                    placeholder="Table number or 'Takeaway'"
                    value={form.table}
                    onChange={e => setForm({ ...form, table: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Payment Method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                  >
                    <option value="upi">Instant UPI QR (Google Pay / PhonePe / Paytm)</option>
                    <option value="razorpay">Credit/Debit Cards & Netbanking (Razorpay)</option>
                    <option value="stripe">International Cards / Apple Pay (Stripe)</option>
                    <option value="cash">Pay at Counter (Cash / UPI / Card)</option>
                  </select>
                </div>

                {loyalty?.rewards?.length > 0 && (
                  <div className="form-group full-width reward-highlight-box">
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      Loyalty Reward Available <Gift size={14} className="text-gold" />
                    </label>
                    <select
                      value={form.rewardId}
                      onChange={e => setForm({ ...form, rewardId: e.target.value })}
                    >
                      <option value="">Do not apply reward now</option>
                      {loyalty.rewards.map(r => (
                        <option key={r._id} value={r._id}>
                          Apply {money(r.amount)} Discount Voucher
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-form-actions">
                <button type="submit" className="theme-btn-primary full-width">
                  <span>Place Order · {money(total)}</span>
                  <ChevronRight size={17} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== OTP IDENTIFICATION MODAL ===================== */}
      {otpModalOpen && (
        <div className="checkout-modal-backdrop" onClick={() => setOtpModalOpen(false)}>
          <div className="otp-modal-card" onClick={e => e.stopPropagation()}>
            <div className="otp-modal-header">
              <div className="otp-icon-emblem">
                <Smartphone size={24} />
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setOtpModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="otp-modal-body">
              <span className="otp-kicker">GUSSTORA VIP ACCESS</span>
              <h3>{otpStep === 1 ? 'Customer Identification' : 'Verify Mobile OTP'}</h3>
              <p className="otp-subtext">
                {otpStep === 1
                  ? 'Enter your mobile number to earn stamps, save order history, and unlock complimentary beverages.'
                  : `Enter the 4-digit verification code sent to ${otpPhone}.`}
              </p>

              {otpStep === 1 ? (
                <form onSubmit={handleRequestOtp} className="otp-form-layout">
                  <div className="form-group">
                    <label>Your Name *</label>
                    <input
                      required
                      placeholder="e.g. Akash Sharma"
                      value={otpName}
                      onChange={e => setOtpName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>10-Digit Mobile Number *</label>
                    <input
                      required
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={otpPhone}
                      onChange={e => setOtpPhone(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="theme-btn-primary full-width"
                    disabled={otpLoading}
                  >
                    <span>{otpLoading ? 'Sending Code…' : 'Send Verification Code'}</span>
                    <ChevronRight size={16} />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="otp-form-layout">
                  <div className="otp-input-wrap">
                    <label>4-Digit Security Code *</label>
                    <input
                      required
                      type="text"
                      maxLength={6}
                      className="otp-code-input"
                      placeholder="••••"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value)}
                      autoFocus
                    />
                  </div>

                  {devOtpHint && (
                    <div className="dev-otp-helper">
                      <span>Verification Code:</span>
                      <button
                        type="button"
                        className="dev-otp-chip"
                        onClick={() => setOtpCode(devOtpHint)}
                      >
                        Auto-Fill {devOtpHint}
                      </button>
                    </div>
                  )}

                  <div className="otp-btn-row">
                    <button
                      type="button"
                      className="theme-btn-secondary"
                      onClick={() => setOtpStep(1)}
                      disabled={otpLoading}
                    >
                      Change Number
                    </button>
                    <button
                      type="submit"
                      className="theme-btn-primary"
                      disabled={otpLoading}
                    >
                      <span>{otpLoading ? 'Verifying…' : 'Verify & Unlock'}</span>
                      <ShieldCheck size={16} />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== IN-STORE VOUCHER QR MODAL ===================== */}
      {selectedVoucherQr && (
        <div className="otp-modal-backdrop" onClick={() => setSelectedVoucherQr(null)}>
          <div className="voucher-qr-modal-container" onClick={e => e.stopPropagation()}>
            <button
              className="otp-close-btn"
              onClick={() => setSelectedVoucherQr(null)}
              title="Close Pass"
            >
              <X size={18} />
            </button>

            <div className="voucher-modal-inner">
              <div className="voucher-modal-brand">
                <img src="/gusstora_emblem.png" alt="Gusstora" className="modal-brand-emblem" />
                <span className="voucher-gold-tag">VIP DINING PASS</span>
                <h2>{money(selectedVoucherQr.amount)} Voucher</h2>
                <p className="voucher-instruction">Present this QR code or Claim Code to your barista or cashier at billing.</p>
              </div>

              <div className="voucher-qr-display-frame">
                <QRCodeSVG
                  value={selectedVoucherQr.claimCode || selectedVoucherQr._id}
                  size={190}
                  bgColor="#ffffff"
                  fgColor="#1A120C"
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="voucher-code-highlight-box">
                <span className="code-eyebrow">CLAIM CODE</span>
                <span className="code-text-big">{selectedVoucherQr.claimCode || 'CLAIMED'}</span>
                <button
                  type="button"
                  className="copy-voucher-code-btn"
                  onClick={() => {
                    if (selectedVoucherQr.claimCode) {
                      navigator.clipboard?.writeText(selectedVoucherQr.claimCode);
                      setNotice(`Copied code ${selectedVoucherQr.claimCode} to clipboard!`);
                    }
                  }}
                >
                  Copy Code
                </button>
              </div>

              {selectedVoucherQr.expiresAt && (
                <span className="modal-voucher-expiry">
                  Expires: {new Date(selectedVoucherQr.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}

              <button
                type="button"
                className="theme-btn-primary full-width"
                onClick={() => setSelectedVoucherQr(null)}
                style={{ marginTop: '1rem' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PHASE 7: PAST ORDER RATING & BOOSTER MODAL ===================== */}
      {historyRatingOrder && (
        <div className="otp-modal-backdrop" onClick={() => setHistoryRatingOrder(null)}>
          <div className="feedback-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-tag">DINER FEEDBACK & BOOSTER</span>
                <h3 className="modal-title">Rate Order #{historyRatingOrder.orderNo}</h3>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setHistoryRatingOrder(null)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body-scrollable">
              {/* Star selector */}
              <div className="star-rating-selector-wrap center">
                <div className="star-rating-buttons">
                  {[1, 2, 3, 4, 5].map(star => {
                    const isActive = (hoverRating || orderRating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        className={`star-select-btn ${isActive ? 'active' : ''}`}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => {
                          setOrderRating(star);
                          setFeedbackSubmitted(false);
                        }}
                      >
                        <Star
                          size={32}
                          fill={isActive ? '#f59e0b' : 'none'}
                          stroke={isActive ? '#f59e0b' : 'var(--text-subtle, #a89f91)'}
                        />
                      </button>
                    );
                  })}
                </div>
                <span className={`rating-verdict-label ${orderRating >= 4 ? 'positive' : orderRating > 0 ? 'critical' : ''}`}>
                  {orderRating === 5
                    ? '5/5 — Exceptional! Pure coffee bliss.'
                    : orderRating === 4
                    ? '4/5 — Very Good! Great brew & service.'
                    : orderRating === 3
                    ? '3/5 — Good. A few things could be better.'
                    : orderRating === 2
                    ? '2/5 — Fair. Did not meet expectations.'
                    : orderRating === 1
                    ? '1/5 — Poor. Needs urgent attention.'
                    : 'Tap a star to rate your experience'}
                </span>
              </div>

              {/* Positive Review Booster */}
              {orderRating >= 4 ? (
                <div className="booster-positive-flow">
                  <div className="booster-banner">
                    <div className="booster-banner-icon">
                      <Star size={18} fill="#f59e0b" color="#f59e0b" />
                    </div>
                    <div className="booster-banner-text">
                      <strong>Google Review Booster</strong>
                      <p>Pick a compliment chip below to copy it and share on Google Reviews!</p>
                    </div>
                  </div>

                  <div className="aspects-selection-cluster">
                    <label className="aspects-label">What did you love most?</label>
                    <div className="aspect-chips-grid">
                      {positiveAspectsList.map(aspect => (
                        <button
                          key={aspect}
                          type="button"
                          className={`aspect-chip ${selectedAspects.includes(aspect) ? 'selected' : ''}`}
                          onClick={() => toggleFeedbackAspect(aspect)}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {getAspectIcon(aspect)}
                            {aspect}
                          </span>
                          {selectedAspects.includes(aspect) && <Check size={12} strokeWidth={3} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="compliment-generator-section">
                    <div className="compliment-head">
                      <Sparkles size={14} className="text-gold" />
                      <span>1-Click Compliments (Tap to copy)</span>
                    </div>
                    <div className="compliment-chips-scroll">
                      {presetCompliments.map((comp, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="compliment-preset-btn"
                          onClick={() => handleSelectCompliment(comp)}
                        >
                          <Copy size={12} />
                          <span>"{comp}"</span>
                        </button>
                      ))}
                    </div>
                    {copiedCompliment && (
                      <div className="copied-pill-toast">
                        <CheckCheck size={13} />
                        <span>Copied to clipboard! Ready to paste into Google.</span>
                      </div>
                    )}
                  </div>

                  <div className="feedback-textarea-box">
                    <textarea
                      rows={3}
                      value={feedbackComment}
                      onChange={e => setFeedbackComment(e.target.value)}
                      placeholder="Add any comments or barista compliments (optional)..."
                    />
                  </div>

                  <div className="booster-actions-row">
                    <a
                      href={googleReviewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="theme-btn-google-boost"
                    >
                      <Star size={16} fill="#fff" />
                      <span>Copy & Post to Google Maps</span>
                      <ExternalLink size={14} />
                    </a>

                    <button
                      type="button"
                      className="theme-btn-primary sm"
                      onClick={() => handleSubmitFeedback(historyRatingOrder)}
                      disabled={submittingFeedback}
                    >
                      {submittingFeedback ? 'Saving…' : 'Submit Review'}
                    </button>
                  </div>
                </div>
              ) : orderRating > 0 ? (
                /* Critical Sentiment */
                <div className="booster-critical-flow">
                  <div className="private-intercept-banner">
                    <div className="intercept-shield-icon">
                      <ShieldCheck size={20} />
                    </div>
                    <div className="intercept-banner-text">
                      <strong>Private Care Channel to Management</strong>
                      <p>
                        Your feedback will be delivered privately to our café owner & manager so we can fix this immediately.
                      </p>
                    </div>
                  </div>

                  <div className="aspects-selection-cluster">
                    <label className="aspects-label">What areas need attention?</label>
                    <div className="aspect-chips-grid critical">
                      {criticalAspectsList.map(aspect => (
                        <button
                          key={aspect}
                          type="button"
                          className={`aspect-chip critical ${selectedAspects.includes(aspect) ? 'selected' : ''}`}
                          onClick={() => toggleFeedbackAspect(aspect)}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {getAspectIcon(aspect)}
                            {aspect}
                          </span>
                          {selectedAspects.includes(aspect) && <Check size={12} strokeWidth={3} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="feedback-textarea-box">
                    <textarea
                      rows={3}
                      value={feedbackComment}
                      onChange={e => setFeedbackComment(e.target.value)}
                      placeholder="Please tell our management what happened..."
                    />
                  </div>

                  <button
                    type="button"
                    className="theme-btn-private-feedback"
                    onClick={() => handleSubmitFeedback(historyRatingOrder)}
                    disabled={submittingFeedback}
                  >
                    <ShieldCheck size={16} />
                    <span>{submittingFeedback ? 'Sending Privately…' : 'Send Privately to Management'}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ===================== PAYMENT GATEWAY MODAL ===================== */}
      {activePaymentModal && (
        <div className="checkout-modal-backdrop" onClick={() => !activePaymentModal.verifying && setActivePaymentModal(null)}>
          <div className="checkout-modal-card" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E8E1D6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#46583B' }}>
                  {activePaymentModal.gateway === 'upi' ? <QrCode size={20} /> : <CreditCard size={20} />}
                </div>
                <div>
                  <span className="modal-tag" style={{ color: '#46583B' }}>SECURE PAYMENT GATEWAY</span>
                  <h3 className="modal-title" style={{ fontSize: 18 }}>
                    {activePaymentModal.gateway === 'upi'
                      ? 'Scan & Pay via UPI'
                      : activePaymentModal.gateway === 'razorpay'
                        ? 'Razorpay Checkout'
                        : activePaymentModal.gateway === 'stripe'
                          ? 'Stripe Global Card Checkout'
                          : 'Online Payment Gateway'}
                  </h3>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => !activePaymentModal.verifying && setActivePaymentModal(null)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', background: '#FDFBF7', borderBottom: '1px solid #EFE8DE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8C7E72', fontWeight: 600 }}>Amount Payable</span>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1A120C' }}>
                  {money(activePaymentModal.intent?.displayAmount || activePaymentModal.intent?.amount || activePaymentModal.order?.total || 0)}
                </div>
              </div>
              <span className={`status-pill payment ${activePaymentModal.order?.paymentStatus === 'paid' ? 'paid' : 'pending'}`}>
                {activePaymentModal.order?.paymentStatus === 'paid' ? 'PAID' : 'AWAITING PAYMENT'}
              </span>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activePaymentModal.gateway === 'upi' ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '16px', background: '#FFFFFF', borderRadius: 12, border: '1px solid #EAE3D9' }}>
                    <div style={{ padding: 12, background: '#FFFFFF', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                      {activePaymentModal.intent?.upiString ? (
                        <QRCodeSVG value={activePaymentModal.intent.upiString} size={180} />
                      ) : (
                        <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <QrCode size={64} color="#C4B9A9" />
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6B584C', marginTop: 10 }}>
                      Scan with Google Pay, PhonePe, Paytm or BHIM
                    </span>
                    <span style={{ fontSize: 11, color: '#9E8E81', marginTop: 2 }}>
                      UPI VPA: <strong>{activePaymentModal.intent?.vpa}</strong>
                    </span>
                  </div>

                  {activePaymentModal.intent?.upiString && (
                    <a
                      href={activePaymentModal.intent.upiString}
                      className="theme-btn-primary full-width"
                      style={{ justifyContent: 'center', textDecoration: 'none' }}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Smartphone size={16} />
                      <span>Open in UPI App (Mobile)</span>
                      <ExternalLink size={14} />
                    </a>
                  )}

                  <p style={{ fontSize: 12, color: '#6B584C', textAlign: 'center', margin: 0 }}>
                    UPI transfers cannot be verified automatically. Your order remains pending until café staff confirms receipt.
                  </p>
                  <button
                    type="button"
                    className="theme-btn-secondary full-width"
                    style={{ justifyContent: 'center' }}
                    onClick={() => setActivePaymentModal(null)}
                  >
                    Done
                  </button>
                </>
              ) : activePaymentModal.gateway === 'razorpay' ? (
                <>
                  <div style={{ padding: 16, background: '#FFFFFF', borderRadius: 12, border: '1px solid #EAE3D9', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A120C' }}>Razorpay Secure Checkout</span>
                      <span style={{ fontSize: 11, background: '#EEF2FF', color: '#4F46E5', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Sandbox supported</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#6B584C', margin: 0 }}>
                      Razorpay Order ID: <code style={{ background: '#F5F0EA', padding: '2px 4px', borderRadius: 4 }}>{activePaymentModal.intent?.razorpayOrderId}</code>
                    </p>
                    <div style={{ padding: 10, background: '#FAF7F2', borderRadius: 8, fontSize: 12, color: '#5C4E43' }}>
                      Accepts Credit/Debit Cards, Net Banking, UPI, and PayLater wallets.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="theme-btn-primary full-width"
                      style={{ justifyContent: 'center' }}
                      disabled={activePaymentModal.verifying || !razorpayReady}
                      onClick={startRazorpayCheckout}
                    >
                      <CheckCircle2 size={16} />
                      <span>{activePaymentModal.verifying ? 'Processing…' : !razorpayReady ? 'Loading secure checkout…' : `Pay ${money(activePaymentModal.intent?.displayAmount || activePaymentModal.order?.total || 0)} (Razorpay)`}</span>
                    </button>
                  </div>
                </>
              ) : activePaymentModal.gateway === 'stripe' ? (
                <>
                  <div style={{ padding: 16, background: '#FFFFFF', borderRadius: 12, border: '1px solid #EAE3D9', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A120C' }}>Stripe Secure Checkout</span>
                      <span style={{ fontSize: 11, background: '#F0FDF4', color: '#16A34A', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Sandbox supported</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#6B584C', margin: 0 }}>
                      Supports Visa, Mastercard, AMEX, Apple Pay, and Google Pay worldwide.
                    </p>
                  </div>

                  <div ref={paymentElementContainer} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="theme-btn-primary full-width"
                      style={{ justifyContent: 'center' }}
                      disabled={activePaymentModal.verifying || !stripePaymentReady}
                      onClick={startStripeCheckout}
                    >
                      <CheckCircle2 size={16} />
                      <span>{activePaymentModal.verifying ? 'Processing…' : `Pay ${money(activePaymentModal.intent?.displayAmount || activePaymentModal.order?.total || 0)} (Stripe)`}</span>
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="theme-btn-primary full-width"
                    style={{ justifyContent: 'center' }}
                    disabled={activePaymentModal.verifying}
                    onClick={() => setActivePaymentModal(null)}
                  >
                    <CheckCircle2 size={16} />
                    <span>Close</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
