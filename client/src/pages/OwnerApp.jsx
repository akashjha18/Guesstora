import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Coffee,
  Coins,
  Eye,
  Gift,
  Home,
  Image as ImageIcon,
  LogOut,
  MoreVertical,
  PackageOpen,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Award,
  ChevronRight,
  ExternalLink,
  FileText,
  History,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  Utensils,
  ChefHat,
  Shield,
  ShieldCheck,
  UserPlus,
  CheckCircle2,
  Lock,
  Power,
  AlertCircle,
  Send,
  Sliders,
  Zap,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Star,
  X,
  ShieldAlert,
  Activity,
  Laptop,
  LayoutGrid,
  Menu as MenuIcon,
  Timer,
  Armchair,
  CalendarCheck,
  Wifi,
  Crown,
  ClipboardList,
  CreditCard,
  CakeSlice,
  Flame,
  Scissors,
  AlertTriangle,
  User,
  Tablet,
  Globe,
  Share2,
  Link2,
  Copy,
  Salad,
  UtensilsCrossed,
  Apple,
  Sandwich,
  Layers,
  Leaf,
  Pizza,
  Percent,
  Tag,
  Receipt,
  WifiOff,
  Boxes,
  Monitor,
  Truck,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api, BASE, getToken, logoutUser } from '../api';
import ShiftModals from '../components/ShiftModals';
import BillOperationsModals from '../components/BillOperationsModals';
import OfflineSyncModal from '../components/OfflineSyncModal';
import { broadcastToCfd } from '../utils/cfdChannel';
import {
  queueOfflineOrder,
  getPendingOfflineOrders,
  syncOfflineOrders,
  cacheMenuCatalog
} from '../utils/offlineStore';
import { getOfflineQueue, flushOfflineQueue, enqueueOfflineOperation } from '../utils/offlineQueue';

const InventoryManager = lazy(() => import('../components/InventoryManager'));
const OmnichannelManager = lazy(() => import('../components/OmnichannelManager'));
const HardwareManager = lazy(() => import('../components/HardwareManager'));
const GstTallyManager = lazy(() => import('../components/GstTallyManager'));
const CommissaryManager = lazy(() => import('../components/CommissaryManager'));
const StaffOperationsManager = lazy(() => import('../components/StaffOperationsManager'));
const AiRoasteryManager = lazy(() => import('../components/AiRoasteryManager'));

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(n || 0);

function getTimeAgo(dateInput) {
  if (!dateInput) return 'Just now';
  const now = Date.now();
  const past = new Date(dateInput).getTime();
  const diffSec = Math.floor((now - past) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mins ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hour${Math.floor(diffSec / 3600) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffSec / 86400)} day${Math.floor(diffSec / 86400) > 1 ? 's' : ''} ago`;
}

function getNavigationText(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getNavigationText).join(' ');
  if (React.isValidElement(node)) return getNavigationText(node.props.children);
  return '';
}

function filterSidebarNavigation(children, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return children;

  return React.Children.map(children, child => {
    if (!React.isValidElement(child)) return child;

    if (child.type === React.Fragment) {
      const filteredChildren = filterSidebarNavigation(child.props.children, normalizedQuery);
      return React.Children.count(filteredChildren)
        ? React.cloneElement(child, {}, filteredChildren)
        : null;
    }

    if (child.props.className?.split(/\s+/).includes('nav-item')) {
      return getNavigationText(child.props.children).toLowerCase().includes(normalizedQuery)
        ? child
        : null;
    }

    return child;
  });
}

function getAvatarColor(char = 'A') {
  const colors = [
    { bg: '#e5e7eb', text: '#374151' }, // Gray
    { bg: '#dbeafe', text: '#1d4ed8' }, // Blue
    { bg: '#ede9fe', text: '#6d28d9' }, // Purple
    { bg: '#fce7f3', text: '#be185d' }, // Pink
    { bg: '#fef3c7', text: '#b45309' }, // Amber
    { bg: '#dcfce7', text: '#15803d' }, // Green
    { bg: '#FDF0E7', text: '#F28A45' }, // Muted Orange
  ];
  const idx = (char.charCodeAt(0) || 0) % colors.length;
  return colors[idx];
}

function parseDeviceUa(ua) {
  if (!ua) return { browser: 'Standard Browser', os: 'Desktop OS', device: 'desktop' };
  let browser = 'Web Browser';
  let os = 'Unknown OS';
  let device = 'desktop';

  if (/mobile|android|iphone|ipod/i.test(ua)) device = 'mobile';
  else if (/ipad|tablet/i.test(ua)) device = 'tablet';

  if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/chrome\//i.test(ua) || /crios\//i.test(ua)) browser = 'Google Chrome';
  else if (/firefox\//i.test(ua) || /fxios\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari\//i.test(ua)) browser = 'Apple Safari';
  else if (/opera|opr\//i.test(ua)) browser = 'Opera';

  if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
  else if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/iphone/i.test(ua)) os = 'iOS';
  else if (/ipad/i.test(ua)) os = 'iPadOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  return { browser, os, device };
}

function formatClientIp(ip) {
  if (!ip || ip === '::1' || ip === '127.0.0.1') return 'Localhost (::1)';
  return ip.replace('::ffff:', '');
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

export default function OwnerApp() {
  const nav = useNavigate();
  const [data, setData] = useState();
  const [tab, setTab] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderMenuOpen, setOrderMenuOpen] = useState(null);
  const [revenueFilter, setRevenueFilter] = useState('Today');
  const [hoveredRushSlot, setHoveredRushSlot] = useState(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState('Today');
  const [orderStatusDropdownOpen, setOrderStatusDropdownOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [verifiedReward, setVerifiedReward] = useState(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [redeemingCode, setRedeemingCode] = useState(false);
  const [redeemNotes, setRedeemNotes] = useState('');
  const [rewardFilter, setRewardFilter] = useState('All');
  // Fave / Chill Bar modern menu state
  const [ownerActiveCategory, setOwnerActiveCategory] = useState('All');
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [ownerDietFilter, setOwnerDietFilter] = useState('all');
  const [ownerSortBy, setOwnerSortBy] = useState('featured');
  const [ownerTagsDropdownOpen, setOwnerTagsDropdownOpen] = useState(false);
  const [ownerSortDropdownOpen, setOwnerSortDropdownOpen] = useState(false);
  const [ownerMenuType, setOwnerMenuType] = useState('Main Menu');
  const [ownerMenuDropdownOpen, setOwnerMenuDropdownOpen] = useState(false);
  const [ownerAddModalOpen, setOwnerAddModalOpen] = useState(false);
  const [ownerQrModalOpen, setOwnerQrModalOpen] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState('');

  // Phase 2: Cashier Shift Management & Day-End Z-Report State
  const [currentShiftData, setCurrentShiftData] = useState(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const [headerShiftDropdownOpen, setHeaderShiftDropdownOpen] = useState(false);
  const [shiftModalMode, setShiftModalMode] = useState(null); // 'open' | 'close' | 'history' | null
  const [openingFloatInput, setOpeningFloatInput] = useState(2000);
  const [closingCountedInput, setClosingCountedInput] = useState('');
  const [shiftNotesInput, setShiftNotesInput] = useState('');
  const [savingShiftAction, setSavingShiftAction] = useState(false);
  const [shiftsHistoryList, setShiftsHistoryList] = useState([]);
  const [loadingShiftsHistory, setLoadingShiftsHistory] = useState(false);
  const [zReportModalData, setZReportModalData] = useState(null); // { zReport, zReportText }

  // Phase 2: Flexible Bill Operations State
  const [transferOrderModal, setTransferOrderModal] = useState(null); // null | order
  const [transferTargetTable, setTransferTargetTable] = useState('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  const [splitOrderModal, setSplitOrderModal] = useState(null); // null | order
  const [splitDinerCount, setSplitDinerCount] = useState(2);
  const [submittingSplit, setSubmittingSplit] = useState(false);
  const [payingSplitId, setPayingSplitId] = useState(null);

  const [discountOrderModal, setDiscountOrderModal] = useState(null); // null | order
  const [discountTypeInput, setDiscountTypeInput] = useState('percent'); // 'percent' | 'flat' | 'promo'
  const [discountValueInput, setDiscountValueInput] = useState(10);
  const [discountPromoInput, setDiscountPromoInput] = useState('');
  const [discountReasonInput, setDiscountReasonInput] = useState('Happy Hour');
  const [discountAuthorizedBy, setDiscountAuthorizedBy] = useState('');
  const [submittingDiscount, setSubmittingDiscount] = useState(false);
  const [promoValidationResult, setPromoValidationResult] = useState(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  // Phase 2: Promo Codes Management State
  const [promoCodesList, setPromoCodesList] = useState([]);
  const [loadingPromoCodes, setLoadingPromoCodes] = useState(false);
  const [showAddPromoModal, setShowAddPromoModal] = useState(false);
  const [promoCodeForm, setPromoCodeForm] = useState({
    code: '',
    discountType: 'percent',
    discountValue: 15,
    minOrderValue: 200,
    maxDiscount: 100,
    validUntil: '',
    usageLimit: 100,
    isActive: true
  });
  const [savingPromoCode, setSavingPromoCode] = useState(false);

  // Phase 7: Offline-First PWA Architecture & Dual-Screen CFD State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(() => getOfflineQueue().length);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [showOfflineSyncModal, setShowOfflineSyncModal] = useState(false);

  // Phase 2: Customer CRM State
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSegment, setCustomerSegment] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [loadingCustomerDetail, setLoadingCustomerDetail] = useState(false);
  const [customerDrawerTab, setCustomerDrawerTab] = useState('orders'); // 'orders' | 'rewards' | 'notes'
  const [customerNotesInput, setCustomerNotesInput] = useState('');
  const [customerEmailInput, setCustomerEmailInput] = useState('');
  const [savingCustomerProfile, setSavingCustomerProfile] = useState(false);

  // CRM Issue Custom Voucher State
  const [issueVoucherModalOpen, setIssueVoucherModalOpen] = useState(false);
  const [voucherAmount, setVoucherAmount] = useState(250);
  const [voucherValidityDays, setVoucherValidityDays] = useState(30);
  const [voucherReason, setVoucherReason] = useState('Birthday Perk');
  const [voucherCustomReason, setVoucherCustomReason] = useState('');
  const [submittingVoucher, setSubmittingVoucher] = useState(false);
  const [voucherSuccessToast, setVoucherSuccessToast] = useState(null);

  // Manual CRM Order State
  const [manualOrderModalOpen, setManualOrderModalOpen] = useState(false);
  const [manualOrderDiner, setManualOrderDiner] = useState(null);
  const [manualOrderName, setManualOrderName] = useState('');
  const [manualOrderPhone, setManualOrderPhone] = useState('');
  const [manualOrderTable, setManualOrderTable] = useState('Counter / Takeaway');
  const [manualOrderPaymentMethod, setManualOrderPaymentMethod] = useState('cash');
  const [manualOrderPaymentStatus, setManualOrderPaymentStatus] = useState('paid');
  const [manualOrderStatus, setManualOrderStatus] = useState('placed');
  const [manualOrderNotes, setManualOrderNotes] = useState('');
  const [manualOrderItems, setManualOrderItems] = useState([]);
  const [manualOrderRewardId, setManualOrderRewardId] = useState('');
  const [manualOrderSearch, setManualOrderSearch] = useState('');
  const [manualOrderCategory, setManualOrderCategory] = useState('All');
  const [submittingManualOrder, setSubmittingManualOrder] = useState(false);
  const [posCustomizingItem, setPosCustomizingItem] = useState(null);
  const [posSelectedVariant, setPosSelectedVariant] = useState(null);
  const [posSelectedModifiers, setPosSelectedModifiers] = useState([]);
  const [posItemNotes, setPosItemNotes] = useState('');
  const [thermalReceiptModal, setThermalReceiptModal] = useState(null); // { order, type: 'kot' | 'bill' }

  // Phase 3: Staff Management & RBAC State
  const [staffList, setStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('all');
  const [staffStatusFilter, setStaffStatusFilter] = useState('all');
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [orderViewMode, setOrderViewMode] = useState('table'); // 'table' | 'kds'
  const [ordersSearchQuery, setOrdersSearchQuery] = useState('');
  const [ordersStatusTab, setOrdersStatusTab] = useState('all');
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'cashier',
  });
  const [savingStaff, setSavingStaff] = useState(false);

  // Phase 4: Automated Reminder & Notification Engine State
  const [reminderSummary, setReminderSummary] = useState(null);
  const [reminderRules, setReminderRules] = useState([]);
  const [reminderAudience, setReminderAudience] = useState({ candidates: [], stats: {} });
  const [reminderLogs, setReminderLogs] = useState([]);
  const [reminderSubTab, setReminderSubTab] = useState('audience'); // 'audience' | 'rules' | 'logs'
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [runningBatch, setRunningBatch] = useState(false);
  const [sendingCandidateId, setSendingCandidateId] = useState(null);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    triggerType: 'near_reward',
    daysThreshold: 5,
    channel: 'whatsapp',
    messageTemplate: 'Hey {customerName}! Only {stampsLeft} stamps left to unlock your free treat at {cafeName}. Visit us soon: {menuUrl}',
    cooldownDays: 7,
    enabled: true,
  });
  const [dispatchModalCandidate, setDispatchModalCandidate] = useState(null);
  const [customDispatchMessage, setCustomDispatchMessage] = useState('');
  const [forceDispatch, setForceDispatch] = useState(false);
  const [dispatchingCustom, setDispatchingCustom] = useState(false);
  const [reminderAudienceSearch, setReminderAudienceSearch] = useState('');
  const [reminderTriggerFilter, setReminderTriggerFilter] = useState('all');
  const [reminderStatusFilter, setReminderStatusFilter] = useState('all');

  const filteredReminderCandidates = useMemo(() => {
    return (reminderAudience?.candidates || []).filter(c => {
      const q = reminderAudienceSearch.toLowerCase();
      const matchesSearch =
        !q ||
        c.customerName?.toLowerCase().includes(q) ||
        c.customerPhone?.includes(q) ||
        c.ruleName?.toLowerCase().includes(q);

      const matchesTrigger =
        reminderTriggerFilter === 'all' || c.triggerType === reminderTriggerFilter;

      const matchesStatus =
        reminderStatusFilter === 'all' ||
        (reminderStatusFilter === 'ready' && !c.inCooldown) ||
        (reminderStatusFilter === 'cooldown' && c.inCooldown);

      return matchesSearch && matchesTrigger && matchesStatus;
    });
  }, [reminderAudience?.candidates, reminderAudienceSearch, reminderTriggerFilter, reminderStatusFilter]);

  // Phase 5: Trend Analytics & Customer Retention State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsRange, setAnalyticsRange] = useState('30d');
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [exportingOrdersCSV, setExportingOrdersCSV] = useState(false);
  const [exportingCustomersCSV, setExportingCustomersCSV] = useState(false);
  const [hoveredTrend, setHoveredTrend] = useState(null);
  const [hoveredHour, setHoveredHour] = useState(null);

  // Phase 7: Diner Feedback & Google Review Booster State
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [feedbackFilter, setFeedbackFilter] = useState('all'); // 'all' | 'positive' | 'critical' | 'unresolved' | 'resolved'
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [resolvingFeedbackModal, setResolvingFeedbackModal] = useState(null);
  const [resolutionNotesInput, setResolutionNotesInput] = useState('');
  const [savingResolution, setSavingResolution] = useState(false);

  const filteredFeedbackList = useMemo(() => {
    return (feedbackList || []).filter(fb => {
      if (feedbackFilter === 'positive') return fb.sentiment === 'positive' || fb.rating >= 4;
      if (feedbackFilter === 'critical') return fb.sentiment === 'critical' || fb.rating <= 3;
      if (feedbackFilter === 'unresolved') return fb.status === 'unresolved';
      if (feedbackFilter === 'resolved') return fb.status === 'resolved';
      return true;
    });
  }, [feedbackList, feedbackFilter]);

  // Phase 8: Printable Table QR Kit Generator State
  const [qrKitPreset, setQrKitPreset] = useState('tent'); // 'tent' | 'compact' | 'luxe'
  const [qrKitTableSelection, setQrKitTableSelection] = useState('all'); // 'all' | 'single'
  const [qrKitSelectedTable, setQrKitSelectedTable] = useState(1);
  const [qrKitCustomHeadline, setQrKitCustomHeadline] = useState('Scan to Order & Collect Stamps');
  const [qrKitCustomSubtext, setQrKitCustomSubtext] = useState('Browse live menu, order from your phone, and earn instant cashback loyalty vouchers.');
  const [qrKitIncludeWifi, setQrKitIncludeWifi] = useState(true);
  const [qrKitWifiSsid, setQrKitWifiSsid] = useState('');
  const [qrKitWifiPassword, setQrKitWifiPassword] = useState('');
  const [qrKitContrastMode, setQrKitContrastMode] = useState('brand'); // 'brand' | 'dark'
  const [qrKitCardSize, setQrKitCardSize] = useState('a6'); // 'a6' | 'square'
  const [qrKitPreviewTableIndex, setQrKitPreviewTableIndex] = useState(1);
  const [copiedTableUrl, setCopiedTableUrl] = useState(false);

  // Phase 9: Security Audit Logs & Session Management State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditStats, setAuditStats] = useState({ total7d: 0, criticalActionsCount: 0, activeSessionsCount: 1 });
  const [auditCategory, setAuditCategory] = useState('all');
  const [auditStatus, setAuditStatus] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [revokingSessions, setRevokingSessions] = useState(false);

  // Phase 10: Advanced Table Reservation & Capacity Engine State
  const [tablesList, setTablesList] = useState([]);
  const [bookingsList, setBookingsList] = useState([]);
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingTableFilter, setBookingTableFilter] = useState('all');
  const [tableSectionFilter, setTableSectionFilter] = useState('all');
  const [floorViewMode, setFloorViewMode] = useState('floor'); // 'floor' | 'reservations'
  const [walkinModal, setWalkinModal] = useState(null); // null | { table }
  const [newBookingModal, setNewBookingModal] = useState(false);
  const [reassignModal, setReassignModal] = useState(null); // null | { booking }
  const [tableConfigModal, setTableConfigModal] = useState(null); // null | { table, isNew }
  const [bookingStats, setBookingStats] = useState({ todayTotal: 0, todaySeated: 0, todayConfirmed: 0, todayPending: 0 });
  const [tableConflictNotice, setTableConflictNotice] = useState(null);
  const [timerTick, setTimerTick] = useState(0);

  // Header Interactive Dropdowns State
  const [headerDateDropdownOpen, setHeaderDateDropdownOpen] = useState(false);
  const [headerNotifDropdownOpen, setHeaderNotifDropdownOpen] = useState(false);
  const [headerProfileDropdownOpen, setHeaderProfileDropdownOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);

  // Form states for Phase 10 modals
  const [walkinPartySize, setWalkinPartySize] = useState(2);
  const [walkinGuestName, setWalkinGuestName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinNote, setWalkinNote] = useState('');
  const [walkinSubmitting, setWalkinSubmitting] = useState(false);

  const [newBookingName, setNewBookingName] = useState('');
  const [newBookingPhone, setNewBookingPhone] = useState('');
  const [newBookingGuests, setNewBookingGuests] = useState(2);
  const [newBookingDateTime, setNewBookingDateTime] = useState('');
  const [newBookingDuration, setNewBookingDuration] = useState(90);
  const [newBookingTableId, setNewBookingTableId] = useState('');
  const [newBookingNote, setNewBookingNote] = useState('');
  const [newBookingSubmitting, setNewBookingSubmitting] = useState(false);

  const [editTableNumber, setEditTableNumber] = useState('');
  const [editTableName, setEditTableName] = useState('');
  const [editTableCapacity, setEditTableCapacity] = useState(4);
  const [editTableSection, setEditTableSection] = useState('Main Floor');
  const [editTableSubmitting, setEditTableSubmitting] = useState(false);

  const [reassignSelectedTableId, setReassignSelectedTableId] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);

  // Authenticated user role derivation
  const currentUser = useMemo(() => {
    try {
      return data?.user || JSON.parse(localStorage.getItem('gusstora_user') || '{}');
    } catch {
      return data?.user || {};
    }
  }, [data]);
  const userRole = currentUser?.role || 'owner';
  const isOwner = userRole === 'owner';
  const isManager = userRole === 'manager';
  const isCashier = userRole === 'cashier';
  const isKitchen = userRole === 'kitchen';

  const [item, setItem] = useState({
    name: '',
    description: '',
    category: 'Coffee',
    price: '',
    veg: true,
    available: true,
    image: '',
    variants: [],
    modifierGroups: []
  });
  const [activeItemModalTab, setActiveItemModalTab] = useState('details'); // 'details' | 'variants' | 'modifiers'

  const photoPresets = [
    { name: 'Sandwich', url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80' },
    { name: 'Hot-Dog Special', url: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=600&auto=format&fit=crop&q=80' },
    { name: 'Salad Tuna', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80' },
    { name: 'Pizza Margherita', url: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&auto=format&fit=crop&q=80' },
    { name: 'Cappuccino', url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600&auto=format&fit=crop&q=80' },
    { name: 'Cheesecake', url: 'https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=600&auto=format&fit=crop&q=80' }
  ];

  async function load() {
    try {
      const res = await api('/owner/dashboard');
      setData(res);
      if (res.tables) setTablesList(res.tables);
      if (res.staff) setStaffList(res.staff);
      if (res.user?.role === 'kitchen') {
        setOrderViewMode('kds');
      }
      if (res.cafe?.wifiSsid) setQrKitWifiSsid(res.cafe.wifiSsid);
      if (res.cafe?.wifiPassword) setQrKitWifiPassword(res.cafe.wifiPassword);
      fetchReminders();
      fetchFeedback();
      fetchCurrentShift();
    } catch (e) {
      if (
        !getToken() ||
        e.message.includes('sign') ||
        e.message.includes('token') ||
        e.message.includes('Authentication') ||
        e.message.includes('Unauthorized') ||
        e.message.includes('Session expired') ||
        e.message.includes('No refresh token')
      ) {
        nav('/owner/login');
      } else {
        setError(e.message);
      }
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      nav('/owner/login');
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get('tab');
    if (initialTab) {
      setTab(initialTab);
    }
    load();
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [tab]);

  // Real-time SSE event listener for automatic dashboard syncing
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let es = null;
    try {
      es = new EventSource(`${BASE}/owner/events?token=${encodeURIComponent(token)}`);
      es.addEventListener('order_created', () => {
        load();
      });
      es.addEventListener('order_updated', () => {
        load();
      });
      es.addEventListener('shift_opened', () => {
        fetchCurrentShift();
        load();
      });
      es.addEventListener('shift_closed', () => {
        fetchCurrentShift();
        load();
      });
      es.addEventListener('booking_created', () => {
        load();
        fetchBookings();
        fetchTables();
      });
      es.addEventListener('booking_updated', () => {
        load();
        fetchBookings();
        fetchTables();
      });
      es.addEventListener('table_updated', () => {
        load();
        fetchTables();
      });
      es.addEventListener('feedback_received', () => {
        fetchFeedback();
      });
      es.addEventListener('feedback_updated', () => {
        fetchFeedback();
      });
    } catch (err) {
      console.warn('Owner SSE listener notice:', err);
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  // Phase 10: Auto-load tables and bookings when Bookings tab is active
  useEffect(() => {
    if (tab === 'bookings') {
      fetchTables();
      fetchBookings(bookingDate, bookingStatusFilter);
    }
  }, [tab, bookingDate, bookingStatusFilter]);

  // Phase 10: 30-second live dining timer tick
  useEffect(() => {
    const tInterval = setInterval(() => {
      setTimerTick(t => t + 1);
    }, 30000);
    return () => clearInterval(tInterval);
  }, []);

  // Close header popovers on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        !e.target.closest('.header-date-container') &&
        !e.target.closest('.header-shift-container') &&
        !e.target.closest('.header-notif-container') &&
        !e.target.closest('.header-profile-container')
      ) {
        setHeaderDateDropdownOpen(false);
        setHeaderShiftDropdownOpen(false);
        setHeaderNotifDropdownOpen(false);
        setHeaderProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Phase 7: Menu Catalog Offline Cache for IndexedDB
  useEffect(() => {
    if (data?.cafe?.menu && data.cafe.menu.length > 0) {
      cacheMenuCatalog(data.cafe.menu, data.cafe).catch(err => {
        console.warn('Failed to cache menu catalog for offline PWA:', err);
      });
    }
  }, [data?.cafe?.menu, data?.cafe]);

  // Phase 7: Offline-First PWA Resilience & Network Sync Listeners
  useEffect(() => {
    async function updateQueueCounter() {
      try {
        const pending = await getPendingOfflineOrders();
        setOfflineQueueCount(pending.length + getOfflineQueue().length);
      } catch {
        setOfflineQueueCount(getOfflineQueue().length);
      }
    }

    updateQueueCounter();

    function handleOnline() {
      setIsOnline(true);
      triggerOfflineSync();
    }
    function handleOffline() {
      setIsOnline(false);
    }
    function handleQueueUpdate() {
      updateQueueCounter();
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pos:queue_updated', handleQueueUpdate);
    window.addEventListener('pos:queue_synced', () => {
      load();
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pos:queue_updated', handleQueueUpdate);
    };
  }, []);

  async function triggerOfflineSync() {
    if (syncingOffline) return;
    setSyncingOffline(true);
    try {
      const res = await syncOfflineOrders(api);
      if (res && res.syncedCount > 0) {
        setError(`Synced ${res.syncedCount} offline order(s) successfully!`);
        await load();
      }
      // Also flush legacy queue if any
      await flushOfflineQueue();
    } catch (err) {
      console.warn('Offline flush error:', err);
    } finally {
      setSyncingOffline(false);
      try {
        const pending = await getPendingOfflineOrders();
        setOfflineQueueCount(pending.length + getOfflineQueue().length);
      } catch {
        setOfflineQueueCount(getOfflineQueue().length);
      }
    }
  }

  // Live notifications aggregation for header bell
  const headerNotifications = useMemo(() => {
    const notifs = [];

    // 1. Pending/active orders
    const activeOrders = (data?.orders || []).filter(o => o.status === 'placed' || o.status === 'preparing');
    activeOrders.slice(0, 3).forEach(o => {
      const orderIdStr = String(o.id || o._id || '');
      notifs.push({
        id: `order-${orderIdStr}`,
        type: 'order',
        title: `Order #${orderIdStr.slice(-4).toUpperCase()} (${(o.status || 'NEW').toUpperCase()})`,
        desc: `Table ${o.tableNumber || 'Takeaway'} • ₹${o.totalAmount || o.total || 0} • ${o.items?.length || 1} item(s)`,
        time: o.createdAt ? new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Live',
        icon: ShoppingBag,
        color: '#176B50',
        action: () => {
          setTab('orders');
          setSelectedOrder(o);
          setHeaderNotifDropdownOpen(false);
        }
      });
    });

    // 2. Upcoming / Confirmed Reservations
    const upcomingBookings = (bookingsList || []).filter(b => b.status === 'confirmed');
    upcomingBookings.slice(0, 3).forEach(b => {
      notifs.push({
        id: `booking-${b.id || b._id}`,
        type: 'booking',
        title: `Reservation: ${b.name}`,
        desc: `Table T-${b.tableNumber || '?'} • ${b.guests} guests at ${new Date(b.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
        time: 'Today',
        icon: CalendarCheck,
        color: '#3b82f6',
        action: () => {
          setTab('bookings');
          setHeaderNotifDropdownOpen(false);
        }
      });
    });

    // 3. Unresolved Diner Feedback
    const unresolvedFbs = (feedbackList || []).filter(fb => fb.status === 'unresolved' || fb.rating <= 3);
    unresolvedFbs.slice(0, 2).forEach(fb => {
      notifs.push({
        id: `feedback-${fb.id || fb._id}`,
        type: 'feedback',
        title: `Diner Feedback (${fb.rating}★)`,
        desc: `${fb.customerName || 'Diner'}: "${(fb.comment || fb.notes || 'New review').slice(0, 38)}..."`,
        time: fb.createdAt ? new Date(fb.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Recent',
        icon: MessageSquare,
        color: '#f59e0b',
        action: () => {
          setTab('feedback');
          setHeaderNotifDropdownOpen(false);
        }
      });
    });

    // 4. Critical Security Logs
    if (auditStats?.criticalActionsCount > 0) {
      notifs.push({
        id: 'sec-audit-alert',
        type: 'security',
        title: 'Security Notice',
        desc: `${auditStats.criticalActionsCount} administrative security events logged.`,
        time: 'Audit',
        icon: ShieldAlert,
        color: '#ef4444',
        action: () => {
          setTab('security');
          setHeaderNotifDropdownOpen(false);
        }
      });
    }

    return notifs;
  }, [data?.orders, bookingsList, feedbackList, auditStats]);

  async function fetchFeedback() {
    setLoadingFeedback(true);
    try {
      const res = await api('/owner/feedback');
      setFeedbackList(res.feedbacks || []);
      setFeedbackStats(res.stats || null);
    } catch (e) {
      console.error('Fetch feedback error:', e);
    } finally {
      setLoadingFeedback(false);
    }
  }

  async function handleResolveFeedback(feedbackId) {
    if (!feedbackId) return;
    setSavingResolution(true);
    try {
      await api(`/owner/feedback/${feedbackId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'resolved',
          resolutionNotes: resolutionNotesInput
        })
      });
      setError('Diner issue marked as resolved.');
      setResolvingFeedbackModal(null);
      setResolutionNotesInput('');
      fetchFeedback();
    } catch (e) {
      setError(e.message || 'Failed to update feedback resolution');
    } finally {
      setSavingResolution(false);
    }
  }

  useEffect(() => {
    if (data?.user?.role === 'kitchen' && tab !== 'orders') {
      setTab('orders');
    }
  }, [data?.user?.role]);

  async function fetchStaff() {
    setLoadingStaff(true);
    try {
      const res = await api('/owner/staff');
      setStaffList(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStaff(false);
    }
  }

  async function fetchAnalytics(range = analyticsRange) {
    setLoadingAnalytics(true);
    try {
      const res = await api(`/owner/analytics?range=${range}`);
      setAnalyticsData(res);
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  async function handleExportOrdersCSV() {
    setExportingOrdersCSV(true);
    try {
      const token = localStorage.getItem('perkbyte_token');
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${BASE}/owner/analytics/export/orders.csv`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${data?.cafe?.slug || 'cafe'}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Could not export orders CSV: ' + err.message);
    } finally {
      setExportingOrdersCSV(false);
    }
  }

  async function handleExportCustomersCSV() {
    setExportingCustomersCSV(true);
    try {
      const token = localStorage.getItem('perkbyte_token');
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${BASE}/owner/analytics/export/customers.csv`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers_${data?.cafe?.slug || 'cafe'}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Could not export customers CSV: ' + err.message);
    } finally {
      setExportingCustomersCSV(false);
    }
  }

  useEffect(() => {
    if (tab === 'analytics') {
      fetchAnalytics(analyticsRange);
    }
  }, [tab, analyticsRange]);

  // Phase 9: Fetch Audit Logs & Active Sessions Handlers
  async function fetchAuditLogs(page = 1, category = auditCategory, status = auditStatus, search = auditSearch) {
    setLoadingAudit(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '50');
      if (category && category !== 'all') params.set('category', category);
      if (status && status !== 'all') params.set('status', status);
      if (search && search.trim()) params.set('search', search.trim());

      const res = await api(`/owner/audit-logs?${params.toString()}`);
      setAuditLogs(res.logs || []);
      setAuditStats(res.stats || { total7d: 0, criticalActionsCount: 0, activeSessionsCount: 1 });
      setAuditPage(res.page || 1);
      setAuditTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  }

  async function fetchSessions() {
    try {
      const res = await api('/owner/sessions');
      setActiveSessions(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to fetch active sessions:', err);
    }
  }

  async function handleRevokeAllSessions() {
    if (!window.confirm('Are you sure you want to revoke all other active sessions? All devices will require fresh sign in.')) {
      return;
    }
    setRevokingSessions(true);
    try {
      const res = await api('/owner/sessions/revoke-all', { method: 'POST' });
      setError(res.message || 'All sessions revoked.');
      await fetchSessions();
      await fetchAuditLogs(1);
    } catch (err) {
      setError(err.message || 'Failed to revoke sessions.');
    } finally {
      setRevokingSessions(false);
    }
  }

  async function handleRevokeSingleSession(sessionId) {
    if (!window.confirm('Revoke authorization for this device session? It will be disconnected immediately.')) {
      return;
    }
    try {
      const res = await api(`/owner/sessions/${sessionId}`, { method: 'DELETE' });
      setError(res.message || 'Device session revoked.');
      await fetchSessions();
      await fetchAuditLogs(1);
    } catch (err) {
      setError(err.message || 'Failed to revoke device session.');
    }
  }

  useEffect(() => {
    if (tab === 'security') {
      fetchAuditLogs(1);
      fetchSessions();
    }
  }, [tab]);


  async function handleCreateStaff(e) {
    e.preventDefault();
    setSavingStaff(true);
    setError('');
    try {
      const res = await api('/owner/staff', {
        method: 'POST',
        body: JSON.stringify(staffForm),
      });
      setError(res.message || 'Staff member added successfully!');
      setShowAddStaffModal(false);
      setStaffForm({ name: '', email: '', phone: '', password: '', role: 'cashier' });
      fetchStaff();
      load();
    } catch (err) {
      setError(err.message || 'Failed to create staff member');
    } finally {
      setSavingStaff(false);
    }
  }

  async function handleUpdateStaff(e) {
    e.preventDefault();
    if (!editingStaff) return;
    setSavingStaff(true);
    setError('');
    try {
      const payload = {
        name: editingStaff.name,
        phone: editingStaff.phone,
        role: editingStaff.role,
        status: editingStaff.status,
      };
      if (editingStaff.newPassword) {
        payload.password = editingStaff.newPassword;
      }
      const res = await api(`/owner/staff/${editingStaff._id || editingStaff.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setError(res.message || 'Staff member updated successfully!');
      setEditingStaff(null);
      fetchStaff();
      load();
    } catch (err) {
      setError(err.message || 'Failed to update staff member');
    } finally {
      setSavingStaff(false);
    }
  }

  async function handleToggleStaffStatus(staffMember) {
    const newStatus = staffMember.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await api(`/owner/staff/${staffMember._id || staffMember.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setError(`Staff member is now ${newStatus}`);
      fetchStaff();
      load();
    } catch (err) {
      setError(err.message || 'Failed to update staff status');
    }
  }

  async function handleDeleteStaff(staffMember) {
    if (!window.confirm(`Are you sure you want to remove staff member "${staffMember.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await api(`/owner/staff/${staffMember._id || staffMember.id}`, {
        method: 'DELETE',
      });
      setError(res.message || 'Staff member removed.');
      fetchStaff();
      load();
    } catch (err) {
      setError(err.message || 'Failed to delete staff member');
    }
  }

  // ===================== Phase 4: Reminder Handlers =====================
  async function fetchReminders() {
    setLoadingReminders(true);
    try {
      const [sumRes, rulesRes, audRes, logsRes] = await Promise.all([
        api('/owner/reminders/summary').catch(() => null),
        api('/owner/reminders/rules').catch(() => []),
        api('/owner/reminders/audience').catch(() => ({ candidates: [], stats: {} })),
        api('/owner/reminders/logs').catch(() => []),
      ]);
      if (sumRes) setReminderSummary(sumRes);
      if (rulesRes) setReminderRules(rulesRes);
      if (audRes) setReminderAudience(audRes);
      if (logsRes) setReminderLogs(logsRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReminders(false);
    }
  }

  async function handleToggleRule(rule) {
    try {
      const updated = await api(`/owner/reminders/rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      setError(`Rule "${rule.name}" is now ${updated.enabled ? 'Active' : 'Paused'}.`);
      fetchReminders();
    } catch (e) {
      setError(e.message || 'Failed to toggle rule');
    }
  }

  async function handleDeleteRule(rule) {
    if (!window.confirm(`Are you sure you want to delete the automation rule "${rule.name}"?`)) return;
    try {
      await api(`/owner/reminders/rules/${rule.id}`, { method: 'DELETE' });
      setError(`Rule "${rule.name}" deleted.`);
      fetchReminders();
    } catch (e) {
      setError(e.message || 'Failed to delete rule');
    }
  }

  async function handleSaveRule(e) {
    e.preventDefault();
    setSavingRule(true);
    setError('');
    try {
      if (editingRule) {
        await api(`/owner/reminders/rules/${editingRule.id}`, {
          method: 'PATCH',
          body: JSON.stringify(ruleForm),
        });
        setError(`Rule "${ruleForm.name}" updated successfully.`);
      } else {
        await api('/owner/reminders/rules', {
          method: 'POST',
          body: JSON.stringify(ruleForm),
        });
        setError(`Automation rule "${ruleForm.name}" created!`);
      }
      setShowRuleModal(false);
      setEditingRule(null);
      fetchReminders();
    } catch (err) {
      setError(err.message || 'Failed to save automation rule');
    } finally {
      setSavingRule(false);
    }
  }

  function handleOpenCreateRuleModal() {
    setEditingRule(null);
    setRuleForm({
      name: '',
      triggerType: 'near_reward',
      daysThreshold: 5,
      channel: 'whatsapp',
      messageTemplate: 'Hey {customerName}! Only {stampsLeft} stamps left to unlock your free treat at {cafeName}. Visit us soon: {menuUrl}',
      cooldownDays: 7,
      enabled: true,
    });
    setShowRuleModal(true);
  }

  function handleOpenEditRuleModal(rule) {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      triggerType: rule.triggerType,
      daysThreshold: rule.daysThreshold,
      channel: rule.channel || 'whatsapp',
      messageTemplate: rule.messageTemplate,
      cooldownDays: rule.cooldownDays,
      enabled: rule.enabled,
    });
    setShowRuleModal(true);
  }

  async function handleDispatchSingle(candidate, customMessage = null, force = false) {
    const cid = candidate.candidateId || candidate.customerId;
    setSendingCandidateId(cid);
    setError('');
    try {
      const res = await api('/owner/reminders/dispatch-single', {
        method: 'POST',
        body: JSON.stringify({
          customerId: candidate.customerId,
          ruleId: candidate.ruleId,
          triggerType: candidate.triggerType,
          channel: candidate.channel || 'whatsapp',
          message: customMessage || candidate.renderedMessage,
          force,
        }),
      });

      if (res.whatsAppUrl) {
        window.open(res.whatsAppUrl, '_blank', 'noopener,noreferrer');
      }

      setError(`WhatsApp reminder logged and opened for ${candidate.customerName}!`);
      setDispatchModalCandidate(null);
      fetchReminders();
    } catch (err) {
      setError(err.message || 'Failed to dispatch reminder');
    } finally {
      setSendingCandidateId(null);
    }
  }

  async function handleRunBatch() {
    setRunningBatch(true);
    setError('');
    try {
      const res = await api('/owner/reminders/run-batch', {
        method: 'POST',
      });
      setError(`Automation scan complete: ${res.sentCount} sent, ${res.skippedCooldownCount} anti-spam protected.`);
      fetchReminders();
    } catch (err) {
      setError(err.message || 'Failed to execute batch scan');
    } finally {
      setRunningBatch(false);
    }
  }

  async function patchOrder(id, body) {
    try {
      await api(`/owner/orders/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setOrderMenuOpen(null);
      if (selectedOrder && selectedOrder._id === id) {
        setSelectedOrder(prev => ({ ...prev, ...body }));
      }
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  // Phase 2: Cashier Shift & Cash Drawer API Operations
  async function fetchCurrentShift() {
    try {
      setLoadingShift(true);
      const res = await api('/owner/shifts/current');
      setCurrentShiftData(res.shift || null);
    } catch (e) {
      console.warn('Fetch shift notice:', e.message);
    } finally {
      setLoadingShift(false);
    }
  }

  async function handleOpenShift(e) {
    if (e && e.preventDefault) e.preventDefault();
    setSavingShiftAction(true);
    setError('');
    try {
      const res = await api('/owner/shifts/open', {
        method: 'POST',
        body: JSON.stringify({
          openingFloat: Number(openingFloatInput) || 0,
          notes: shiftNotesInput.trim() || undefined
        })
      });
      setCurrentShiftData(res.shift);
      setShiftModalMode(null);
      setShiftNotesInput('');
      load();
    } catch (err) {
      setError(err.message || 'Failed to open register shift');
    } finally {
      setSavingShiftAction(false);
    }
  }

  async function handleCloseShift(e) {
    if (e && e.preventDefault) e.preventDefault();
    setSavingShiftAction(true);
    setError('');
    try {
      const res = await api('/owner/shifts/close', {
        method: 'POST',
        body: JSON.stringify({
          countedCash: Number(closingCountedInput) || 0,
          notes: shiftNotesInput.trim() || undefined
        })
      });
      setCurrentShiftData(null);
      setShiftModalMode(null);
      setClosingCountedInput('');
      setShiftNotesInput('');
      if (res.zReport) {
        setZReportModalData(res.zReport);
      }
      load();
    } catch (err) {
      setError(err.message || 'Failed to close register shift');
    } finally {
      setSavingShiftAction(false);
    }
  }

  async function fetchShiftsHistory() {
    setLoadingShiftsHistory(true);
    try {
      const res = await api('/owner/shifts');
      if (res.shifts) setShiftsHistoryList(res.shifts);
    } catch (err) {
      console.error('Fetch shifts history error:', err);
    } finally {
      setLoadingShiftsHistory(false);
    }
  }

  async function fetchZReport(shiftId) {
    try {
      const res = await api(`/owner/shifts/${shiftId}/z-report`);
      if (res.zReport) {
        setZReportModalData(res.zReport);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch Z-Report');
    }
  }

  // Phase 2: Flexible Bill Operations (Table Transfer, Split Bill, Discount)
  async function handleTransferTable(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!transferOrderModal?._id || !transferTargetTable) return;
    setSubmittingTransfer(true);
    setError('');
    try {
      const res = await api(`/owner/orders/${transferOrderModal._id}/transfer-table`, {
        method: 'POST',
        body: JSON.stringify({ targetTable: transferTargetTable })
      });
      if (selectedOrder?._id === transferOrderModal._id) {
        setSelectedOrder(res.order);
      }
      setTransferOrderModal(null);
      setTransferTargetTable('');
      load();
      fetchTables();
    } catch (err) {
      setError(err.message || 'Failed to transfer table');
    } finally {
      setSubmittingTransfer(false);
    }
  }

  async function handleSplitBill(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!splitOrderModal?._id) return;
    setSubmittingSplit(true);
    setError('');
    try {
      const res = await api(`/owner/orders/${splitOrderModal._id}/split`, {
        method: 'POST',
        body: JSON.stringify({ dinerCount: Number(splitDinerCount) || 2 })
      });
      if (selectedOrder?._id === splitOrderModal._id) {
        setSelectedOrder(res.order);
      }
      setSplitOrderModal(res.order);
      load();
    } catch (err) {
      setError(err.message || 'Failed to split bill');
    } finally {
      setSubmittingSplit(false);
    }
  }

  async function handlePaySplit(orderId, splitId, method = 'cash') {
    setPayingSplitId(splitId);
    setError('');
    try {
      const res = await api(`/owner/orders/${orderId}/split/${splitId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ method })
      });
      if (selectedOrder?._id === orderId) {
        setSelectedOrder(res.order);
      }
      if (splitOrderModal?._id === orderId) {
        setSplitOrderModal(res.order);
      }
      load();
    } catch (err) {
      setError(err.message || 'Failed to settle split payment');
    } finally {
      setPayingSplitId(null);
    }
  }

  async function handleValidatePromo(code) {
    if (!code) return;
    setValidatingPromo(true);
    setPromoValidationResult(null);
    try {
      const slug = data?.cafe?.slug || 'artisan-roastery';
      const subtotal = discountOrderModal?.subtotal || discountOrderModal?.total || 0;
      const res = await api(`/public/cafes/${slug}/promo-codes/validate`, {
        method: 'POST',
        body: JSON.stringify({ code, subtotal })
      });
      setPromoValidationResult(res);
      if (res.valid && res.promo) {
        if (res.promo.discountType === 'percent') {
          setDiscountTypeInput('percent');
          setDiscountValueInput(res.promo.discountValue);
        } else {
          setDiscountTypeInput('flat');
          setDiscountValueInput(res.promo.discountValue);
        }
      }
    } catch (err) {
      setPromoValidationResult({ valid: false, message: err.message || 'Invalid promo code' });
    } finally {
      setValidatingPromo(false);
    }
  }

  async function handleApplyDiscount(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!discountOrderModal?._id) return;
    setSubmittingDiscount(true);
    setError('');
    try {
      const payload = {
        type: discountTypeInput,
        value: Number(discountValueInput) || 0,
        promoCode: discountTypeInput === 'promo' ? discountPromoInput : undefined,
        reason: discountReasonInput || 'Management courtesy',
        authorizedBy: discountAuthorizedBy || currentUser?.name || 'Manager'
      };
      const res = await api(`/owner/orders/${discountOrderModal._id}/apply-discount`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (selectedOrder?._id === discountOrderModal._id) {
        setSelectedOrder(res.order);
      }
      setDiscountOrderModal(null);
      setPromoValidationResult(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to apply discount');
    } finally {
      setSubmittingDiscount(false);
    }
  }

  // Phase 2: Promo Codes Management API Operations
  async function fetchPromoCodes() {
    setLoadingPromoCodes(true);
    try {
      const res = await api('/owner/promo-codes');
      if (res.promoCodes) setPromoCodesList(res.promoCodes);
    } catch (err) {
      console.error('Fetch promo codes error:', err);
    } finally {
      setLoadingPromoCodes(false);
    }
  }

  async function handleCreatePromoCode(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!promoCodeForm.code) return;
    setSavingPromoCode(true);
    try {
      await api('/owner/promo-codes', {
        method: 'POST',
        body: JSON.stringify({
          ...promoCodeForm,
          code: promoCodeForm.code.toUpperCase().trim(),
          discountValue: Number(promoCodeForm.discountValue) || 0,
          minOrderValue: Number(promoCodeForm.minOrderValue) || 0,
          maxDiscount: Number(promoCodeForm.maxDiscount) || 0,
          usageLimit: Number(promoCodeForm.usageLimit) || 100,
        })
      });
      setShowAddPromoModal(false);
      setPromoCodeForm({
        code: '',
        discountType: 'percent',
        discountValue: 15,
        minOrderValue: 200,
        maxDiscount: 100,
        validUntil: '',
        usageLimit: 100,
        isActive: true
      });
      fetchPromoCodes();
    } catch (err) {
      setError(err.message || 'Failed to create promo code');
    } finally {
      setSavingPromoCode(false);
    }
  }

  async function handleTogglePromoCode(id, currentActive) {
    try {
      await api(`/owner/promo-codes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !currentActive })
      });
      fetchPromoCodes();
    } catch (err) {
      setError(err.message || 'Failed to update promo code');
    }
  }

  // Phase 10 Table & Reservation Methods
  async function fetchTables() {
    try {
      const res = await api('/owner/tables');
      if (Array.isArray(res)) setTablesList(res);
    } catch (e) {
      console.error('Fetch tables error:', e);
    }
  }

  async function fetchBookings(date = bookingDate, status = bookingStatusFilter) {
    try {
      let q = `/owner/bookings?date=${encodeURIComponent(date)}`;
      if (status && status !== 'all') q += `&status=${encodeURIComponent(status)}`;
      if (bookingSearch) q += `&search=${encodeURIComponent(bookingSearch)}`;
      const res = await api(q);
      if (res.bookings) setBookingsList(res.bookings);
      if (res.stats) setBookingStats(res.stats);
    } catch (e) {
      console.error('Fetch bookings error:', e);
    }
  }

  async function handleQuickWalkinSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!walkinModal?.table?.id) return;
    setWalkinSubmitting(true);
    setTableConflictNotice(null);
    try {
      await api('/owner/bookings/quick-walkin', {
        method: 'POST',
        body: JSON.stringify({
          tableId: walkinModal.table.id,
          guests: Number(walkinPartySize) || walkinModal.table.capacity || 2,
          name: walkinGuestName.trim() || undefined,
          phone: walkinPhone.trim() || undefined,
          note: walkinNote.trim() || undefined,
        })
      });
      setWalkinModal(null);
      setWalkinGuestName('');
      setWalkinPhone('');
      setWalkinNote('');
      fetchTables();
      fetchBookings();
      load();
    } catch (err) {
      setTableConflictNotice(err.message || 'Failed to seat walk-in party');
    } finally {
      setWalkinSubmitting(false);
    }
  }

  async function handleCreateBookingSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!newBookingName || !newBookingPhone || !newBookingDateTime) {
      setTableConflictNotice('Name, 10-digit phone number, and reservation time are required.');
      return;
    }
    setNewBookingSubmitting(true);
    setTableConflictNotice(null);
    try {
      await api('/owner/bookings', {
        method: 'POST',
        body: JSON.stringify({
          name: newBookingName.trim(),
          phone: newBookingPhone.trim(),
          guests: Number(newBookingGuests) || 2,
          dateTime: new Date(newBookingDateTime).toISOString(),
          durationMinutes: Number(newBookingDuration) || 90,
          tableId: newBookingTableId || undefined,
          note: newBookingNote.trim() || undefined,
        })
      });
      setNewBookingModal(false);
      setNewBookingName('');
      setNewBookingPhone('');
      setNewBookingDateTime('');
      setNewBookingNote('');
      setNewBookingTableId('');
      fetchTables();
      fetchBookings();
      load();
    } catch (err) {
      setTableConflictNotice(err.message || 'Failed to create reservation.');
    } finally {
      setNewBookingSubmitting(false);
    }
  }

  async function handleBookingStatusChange(bookingId, status) {
    try {
      await api(`/owner/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      fetchBookings();
      fetchTables();
      load();
    } catch (err) {
      setError(err.message || 'Failed to update reservation status');
    }
  }

  async function patchBooking(id, status) {
    return handleBookingStatusChange(id, status);
  }

  async function handleSeatTableNow(t, activeBooking) {
    try {
      const bId = activeBooking?.id || activeBooking?._id || t.currentBookingId;
      if (bId) {
        await api(`/owner/bookings/${bId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'seated' })
        });
      } else {
        await api(`/owner/tables/${t.id}/seat`, {
          method: 'POST',
          body: JSON.stringify({
            bookingId: activeBooking?.id || activeBooking?._id || undefined,
            name: activeBooking?.name || undefined,
            phone: activeBooking?.phone || undefined,
            guests: activeBooking?.guests || t.capacity || 2,
          })
        });
      }
      fetchTables();
      fetchBookings();
      load();
    } catch (err) {
      setError(err.message || 'Failed to seat guest at table');
    }
  }

  async function handleAssignTableSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!reassignModal?.booking?.id) return;
    setReassignSubmitting(true);
    setTableConflictNotice(null);
    try {
      await api(`/owner/bookings/${reassignModal.booking.id}/assign-table`, {
        method: 'PATCH',
        body: JSON.stringify({
          tableId: reassignSelectedTableId || null,
        })
      });
      setReassignModal(null);
      setReassignSelectedTableId('');
      fetchBookings();
      fetchTables();
      load();
    } catch (err) {
      setTableConflictNotice(err.message || 'Failed to assign table');
    } finally {
      setReassignSubmitting(false);
    }
  }

  async function handleFreeTable(tableId) {
    try {
      await api(`/owner/tables/${tableId}/free`, { method: 'POST' });
      fetchTables();
      fetchBookings();
      load();
    } catch (err) {
      setError(err.message || 'Failed to free table');
    }
  }

  async function handleSaveTableSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!editTableNumber.trim()) return;
    setEditTableSubmitting(true);
    try {
      if (tableConfigModal?.table?.id) {
        await api(`/owner/tables/${tableConfigModal.table.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            tableNumber: editTableNumber.trim(),
            name: editTableName.trim() || undefined,
            capacity: Number(editTableCapacity) || 4,
            section: editTableSection,
          })
        });
      } else {
        await api('/owner/tables', {
          method: 'POST',
          body: JSON.stringify({
            tableNumber: editTableNumber.trim(),
            name: editTableName.trim() || undefined,
            capacity: Number(editTableCapacity) || 4,
            section: editTableSection,
          })
        });
      }
      setTableConfigModal(null);
      fetchTables();
      load();
    } catch (err) {
      setError(err.message || 'Failed to save table layout');
    } finally {
      setEditTableSubmitting(false);
    }
  }

  async function handleDeleteTable(tableId) {
    if (!window.confirm('Are you sure you want to remove this table from the floor plan?')) return;
    try {
      await api(`/owner/tables/${tableId}`, { method: 'DELETE' });
      fetchTables();
      load();
    } catch (err) {
      setError(err.message || 'Failed to remove table');
    }
  }

  function getWhatsAppBookingUrl(b) {
    if (!b?.phone) return '#';
    const dateStr = new Date(b.dateTime).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = new Date(b.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const cafeName = data?.cafe?.name || 'Gusstora Artisan Roastery';
    const tableInfo = b.tableNumber ? `Table T-${b.tableNumber}` : 'Table Assigned upon arrival';
    const msg = `Greetings ${b.name}! Your table reservation at ${cafeName} is confirmed for ${b.guests} guests on ${dateStr} at ${timeStr} (${tableInfo}). We look forward to hosting you!`;
    return `https://wa.me/91${cleanPhone(b.phone)}?text=${encodeURIComponent(msg)}`;
  }

  function getDiningTimer(seatedAt, durationMinutes = 90) {
    if (!seatedAt) return { elapsedMinutes: 0, percent: 0, isOvertime: false, text: '0m' };
    const elapsedMs = Math.max(0, Date.now() - new Date(seatedAt).getTime());
    const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
    const percent = Math.min(100, Math.round((elapsedMinutes / durationMinutes) * 100));
    const isOvertime = elapsedMinutes > durationMinutes;
    return {
      elapsedMinutes,
      percent,
      isOvertime,
      text: `${elapsedMinutes}m / ${durationMinutes}m`,
    };
  }

  async function handleVerifyReward(codeToVerify) {
    const code = (codeToVerify || redeemCode).trim();
    if (!code) {
      setError('Please enter a claim code or reward ID');
      return;
    }
    setVerifyingCode(true);
    setVerifiedReward(null);
    try {
      const res = await api('/owner/rewards/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      setVerifiedReward(res);
      setError('');
    } catch (err) {
      setError(err.message || 'Invalid or unverified voucher code');
      setVerifiedReward(null);
    } finally {
      setVerifyingCode(false);
    }
  }

  async function handleRedeemReward(codeToRedeem) {
    const code = (codeToRedeem || verifiedReward?.reward?.claimCode || verifiedReward?.reward?._id || redeemCode).trim();
    if (!code) {
      setError('Please enter a claim code');
      return;
    }
    setRedeemingCode(true);
    try {
      const res = await api('/owner/rewards/redeem', {
        method: 'POST',
        body: JSON.stringify({ code, notes: redeemNotes }),
      });
      setError(res.message || 'Reward redeemed successfully!');
      setVerifiedReward(null);
      setRedeemCode('');
      setRedeemNotes('');
      load();
    } catch (err) {
      setError(err.message || 'Failed to redeem voucher');
    } finally {
      setRedeemingCode(false);
    }
  }

  async function openCustomerProfile(customer) {
    setSelectedCustomer(customer);
    setCustomerNotesInput(customer.notes || '');
    setCustomerEmailInput(customer.email || '');
    setCustomerDrawerTab('orders');
    setLoadingCustomerDetail(true);
    try {
      const res = await api(`/owner/customers/${customer.id || customer._id}`);
      setCustomerDetail(res);
      setCustomerNotesInput(res.customer?.notes || '');
      setCustomerEmailInput(res.customer?.email || '');
    } catch (err) {
      console.warn('Could not fetch full customer profile:', err);
      const custOrders = (data?.orders || []).filter(o => o.phone === customer.phone || o.customerId === customer._id);
      setCustomerDetail({
        customer,
        orders: custOrders,
        rewards: customer.rewards || [],
        loyalty: customer.progress || {
          visits: customer.visits || 0,
          required: data?.cafe?.loyalty?.visitsRequired || 8,
          remaining: Math.max(0, (data?.cafe?.loyalty?.visitsRequired || 8) - (customer.visits || 0)),
        },
      });
    } finally {
      setLoadingCustomerDetail(false);
    }
  }

  async function handleSaveCustomerProfile(e) {
    if (e) e.preventDefault();
    if (!selectedCustomer) return;
    setSavingCustomerProfile(true);
    try {
      const res = await api(`/owner/customers/${selectedCustomer.id || selectedCustomer._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          notes: customerNotesInput,
          email: customerEmailInput,
        }),
      });
      setError(res.message || 'Customer profile updated!');
      setSelectedCustomer(prev => ({ ...prev, notes: customerNotesInput, email: customerEmailInput }));
      setCustomerDetail(prev => prev ? {
        ...prev,
        customer: { ...prev.customer, notes: customerNotesInput, email: customerEmailInput }
      } : null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to save customer changes');
    } finally {
      setSavingCustomerProfile(false);
    }
  }

  async function handleIssueCustomVoucher(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedCustomer) return;
    const finalAmount = Math.max(1, Math.round(Number(voucherAmount) || 0));
    if (!finalAmount) {
      setError('Please enter a valid voucher amount.');
      return;
    }
    const finalNotes = voucherReason === 'Custom'
      ? (voucherCustomReason.trim() || 'Custom Voucher')
      : voucherReason;

    setSubmittingVoucher(true);
    try {
      const res = await api(`/owner/customers/${selectedCustomer.id || selectedCustomer._id}/issue-voucher`, {
        method: 'POST',
        body: JSON.stringify({
          amount: finalAmount,
          validityDays: Number(voucherValidityDays) || 30,
          notes: finalNotes,
        }),
      });

      if (res.reward) {
        setCustomerDetail(prev => {
          if (!prev) return prev;
          const updatedRewards = [res.reward, ...(prev.rewards || [])];
          return {
            ...prev,
            rewards: updatedRewards,
            customer: {
              ...prev.customer,
              activeRewardsCount: (prev.customer?.activeRewardsCount || 0) + 1,
              rewards: updatedRewards,
            },
          };
        });
      }

      setIssueVoucherModalOpen(false);
      setVoucherSuccessToast(`Issued ₹${finalAmount} voucher (${res.reward?.claimCode || 'CLM'})!`);
      setTimeout(() => setVoucherSuccessToast(null), 4000);
      load();
    } catch (err) {
      setError(err.message || 'Failed to issue custom voucher');
    } finally {
      setSubmittingVoucher(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    let list = data?.customers || [];
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase().trim();
      list = list.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }
    if (customerSegment === 'vip') {
      list = list.filter(c => (c.totalSpend || 0) >= 1000);
    } else if (customerSegment === 'reward_ready') {
      const req = data?.cafe?.loyalty?.visitsRequired || 8;
      list = list.filter(c => (c.visits || 0) >= req || (c.activeRewardsCount || 0) > 0);
    } else if (customerSegment === 'frequent') {
      list = list.filter(c => (c.visits || 0) >= 3);
    }
    return list;
  }, [data?.customers, customerSearch, customerSegment, data?.cafe]);

  // ===================== MANUAL CRM ORDER HELPERS & CART =====================
  function openManualOrderModal(customer = null) {
    setManualOrderDiner(customer);
    setManualOrderName(customer ? customer.name || '' : '');
    setManualOrderPhone(customer ? customer.phone || '' : '');
    setManualOrderTable('Counter / Takeaway');
    setManualOrderPaymentMethod('cash');
    setManualOrderPaymentStatus('paid');
    setManualOrderStatus('placed');
    setManualOrderNotes('');
    setManualOrderItems([]);
    setManualOrderRewardId('');
    setManualOrderSearch('');
    setManualOrderCategory('All');
    setManualOrderModalOpen(true);
  }

  function addItemToManualOrder(menuItem) {
    const hasVariants = Array.isArray(menuItem.variants) && menuItem.variants.length > 0;
    const hasMods = Array.isArray(menuItem.modifierGroups) && menuItem.modifierGroups.length > 0;

    if (hasVariants || hasMods) {
      setPosCustomizingItem(menuItem);
      setPosSelectedVariant(hasVariants ? menuItem.variants[0] : null);
      const initialMods = [];
      if (hasMods) {
        menuItem.modifierGroups.forEach(grp => {
          if (grp.required && grp.options?.length > 0) {
            initialMods.push({
              groupId: grp.id,
              optionId: grp.options[0].id,
              name: grp.options[0].name,
              price: Number(grp.options[0].price) || 0,
            });
          }
        });
      }
      setPosSelectedModifiers(initialMods);
      setPosItemNotes('');
      return;
    }

    const lineKey = `${menuItem.id || menuItem._id}_def`;
    setManualOrderItems(prev => {
      const existing = prev.find(i => (i.lineId || i.menuItemId) === lineKey);
      if (existing) {
        return prev.map(i =>
          (i.lineId || i.menuItemId) === lineKey ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          lineId: lineKey,
          menuItemId: menuItem.id || menuItem._id,
          name: menuItem.name,
          price: Number(menuItem.price) || 0,
          quantity: 1,
          category: menuItem.category || 'General',
          image: menuItem.image || '',
          selectedVariant: null,
          selectedModifiers: [],
          notes: '',
        },
      ];
    });
  }

  function confirmPosCustomizedItem() {
    if (!posCustomizingItem) return;
    const item = posCustomizingItem;
    const basePrice = posSelectedVariant ? (Number(posSelectedVariant.price) || 0) : (Number(item.price) || 0);
    const modsPrice = (posSelectedModifiers || []).reduce((s, m) => s + (Number(m.price) || 0), 0);
    const unitPrice = basePrice + modsPrice;

    const modKeys = (posSelectedModifiers || []).map(m => m.optionId).sort().join('-');
    const vKey = posSelectedVariant ? posSelectedVariant.id : 'nov';
    const nKey = (posItemNotes || '').trim().toLowerCase();
    const lineKey = `${item.id || item._id}_v${vKey}_m${modKeys}_n${nKey}`;

    setManualOrderItems(prev => {
      const existing = prev.find(i => (i.lineId || i.menuItemId) === lineKey);
      if (existing) {
        return prev.map(i => (i.lineId || i.menuItemId) === lineKey ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [
        ...prev,
        {
          lineId: lineKey,
          menuItemId: item.id || item._id,
          name: item.name,
          price: unitPrice,
          quantity: 1,
          category: item.category || 'General',
          image: item.image || '',
          selectedVariant: posSelectedVariant ? { id: posSelectedVariant.id, name: posSelectedVariant.name, price: posSelectedVariant.price } : null,
          selectedModifiers: (posSelectedModifiers || []).map(m => ({ groupId: m.groupId, optionId: m.optionId, name: m.name, price: m.price })),
          notes: (posItemNotes || '').trim(),
        },
      ];
    });
    setPosCustomizingItem(null);
  }

  function updateManualOrderItemQty(lineId, delta) {
    setManualOrderItems(prev => {
      return prev
        .map(i => {
          if ((i.lineId || i.menuItemId) === lineId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean);
    });
  }

  function removeManualOrderItem(lineId) {
    setManualOrderItems(prev => prev.filter(i => (i.lineId || i.menuItemId) !== lineId));
  }

  const availableManualMenuCategories = useMemo(() => {
    const cats = new Set(['All']);
    (data?.cafe?.menu || []).forEach(item => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats);
  }, [data?.cafe?.menu]);

  const filteredManualMenuItems = useMemo(() => {
    let items = data?.cafe?.menu || [];
    if (manualOrderCategory !== 'All') {
      items = items.filter(i => i.category === manualOrderCategory);
    }
    if (manualOrderSearch.trim()) {
      const q = manualOrderSearch.toLowerCase().trim();
      items = items.filter(i =>
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q))
      );
    }
    return items;
  }, [data?.cafe?.menu, manualOrderCategory, manualOrderSearch]);

  const manualSubtotal = useMemo(() => {
    return manualOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [manualOrderItems]);

  const selectedDinerRewards = useMemo(() => {
    if (manualOrderDiner?.rewards?.length) {
      return manualOrderDiner.rewards.filter(
        r => (r.status === 'available' || r.status === 'claimed') && (!r.expiresAt || new Date(r.expiresAt) > new Date())
      );
    }
    const cleanP = manualOrderPhone.replace(/\D/g, '').slice(-10);
    if (cleanP.length === 10) {
      const matched = (data?.customers || []).find(c => c.phone === cleanP);
      if (matched?.rewards?.length) {
        return matched.rewards.filter(
          r => (r.status === 'available' || r.status === 'claimed') && (!r.expiresAt || new Date(r.expiresAt) > new Date())
        );
      }
    }
    return [];
  }, [manualOrderDiner, manualOrderPhone, data?.customers]);

  const manualDiscount = useMemo(() => {
    if (!manualOrderRewardId) return 0;
    const rew = selectedDinerRewards.find(r => r.id === manualOrderRewardId || r._id === manualOrderRewardId);
    if (!rew) return 0;
    return Math.min(Number(rew.amount) || 0, manualSubtotal);
  }, [manualOrderRewardId, selectedDinerRewards, manualSubtotal]);

  const manualTotal = Math.max(0, manualSubtotal - manualDiscount);

  // Phase 7: Real-Time Dual Screen Customer Facing Display (CFD) Synchronization
  useEffect(() => {
    if (!manualOrderModalOpen) {
      broadcastToCfd({
        type: 'IDLE',
        cafe: data?.cafe
      });
      return;
    }

    broadcastToCfd({
      type: 'CART_UPDATE',
      cafe: data?.cafe,
      order: {
        customerName: manualOrderName || 'Walk-in Guest',
        customerPhone: manualOrderPhone || '',
        table: manualOrderTable,
        paymentMethod: manualOrderPaymentMethod,
        items: manualOrderItems,
        subtotal: manualSubtotal,
        discount: manualDiscount,
        total: manualTotal,
      }
    });
  }, [
    manualOrderModalOpen,
    manualOrderItems,
    manualSubtotal,
    manualDiscount,
    manualTotal,
    manualOrderName,
    manualOrderPhone,
    manualOrderTable,
    manualOrderPaymentMethod,
    data?.cafe
  ]);

  async function handleSubmitManualOrder(e) {
    if (e) e.preventDefault();
    if (!manualOrderName.trim()) {
      setError('Please provide customer name');
      return;
    }
    const cleanPhone = manualOrderPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setError('Please provide a valid 10-digit mobile number');
      return;
    }
    if (manualOrderItems.length === 0) {
      setError('Please add at least one menu item to the order');
      return;
    }

    setSubmittingManualOrder(true);
    const payload = {
      name: manualOrderName.trim(),
      phone: cleanPhone,
      customerId: manualOrderDiner?.id || manualOrderDiner?._id || undefined,
      table: manualOrderTable,
      paymentMethod: manualOrderPaymentMethod,
      paymentStatus: manualOrderPaymentStatus,
      status: manualOrderStatus,
      notes: manualOrderNotes.trim() || undefined,
      rewardId: manualOrderRewardId || undefined,
      items: manualOrderItems.map(i => ({
        menuItemId: i.menuItemId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        selectedVariant: i.selectedVariant,
        selectedModifiers: i.selectedModifiers,
        notes: i.notes,
      })),
      subtotal: manualSubtotal,
      discount: manualDiscount,
      total: manualTotal,
    };

    if (!navigator.onLine) {
      try {
        const queuedItem = await queueOfflineOrder(payload);
        const pending = await getPendingOfflineOrders();
        setOfflineQueueCount(pending.length + getOfflineQueue().length);
        setManualOrderModalOpen(false);
        setError(`[OFFLINE MODE] Order queued locally in IndexedDB drawer! (#${queuedItem.offlineId.slice(-6).toUpperCase()})`);
        broadcastToCfd({
          type: 'ORDER_COMPLETED',
          cafe: data?.cafe,
          order: {
            orderNo: queuedItem.offlineId.slice(-4).toUpperCase(),
            customerName: manualOrderName,
            total: manualTotal,
            items: manualOrderItems,
            table: manualOrderTable,
            paymentMethod: manualOrderPaymentMethod,
            savings: manualDiscount,
            isOffline: true
          }
        });
      } catch (qErr) {
        const legacy = enqueueOfflineOperation({
          type: 'CREATE_ORDER',
          url: '/owner/orders',
          method: 'POST',
          body: payload
        });
        setOfflineQueueCount(getOfflineQueue().length);
        setManualOrderModalOpen(false);
        setError(`[OFFLINE MODE] Order queued! (Queue #${legacy.id.slice(-4)})`);
      } finally {
        setSubmittingManualOrder(false);
      }
      return;
    }

    try {
      const res = await api('/owner/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await load();

      if (selectedCustomer && (selectedCustomer.phone === cleanPhone || selectedCustomer.id === payload.customerId)) {
        try {
          const updatedCustRes = await api(`/owner/customers/${selectedCustomer.id || selectedCustomer._id}`);
          setCustomerDetail(updatedCustRes);
        } catch (_) {}
      }

      setManualOrderModalOpen(false);
      setError(`Order #${res.order?.orderNo || ''} created successfully! Total: ₹${res.order?.total ?? manualTotal}`);

      broadcastToCfd({
        type: 'ORDER_COMPLETED',
        cafe: data?.cafe,
        order: {
          orderNo: res.order?.orderNo || 'POS',
          customerName: manualOrderName,
          total: res.order?.total ?? manualTotal,
          items: manualOrderItems,
          table: manualOrderTable,
          paymentMethod: manualOrderPaymentMethod,
          savings: manualDiscount,
        }
      });
    } catch (err) {
      if (!navigator.onLine || err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
        try {
          const queuedItem = await queueOfflineOrder(payload);
          const pending = await getPendingOfflineOrders();
          setOfflineQueueCount(pending.length + getOfflineQueue().length);
          setManualOrderModalOpen(false);
          setError(`[OFFLINE SAVED] Network drop detected. Order queued in IndexedDB memory! (#${queuedItem.offlineId.slice(-6).toUpperCase()})`);
          broadcastToCfd({
            type: 'ORDER_COMPLETED',
            cafe: data?.cafe,
            order: {
              orderNo: queuedItem.offlineId.slice(-4).toUpperCase(),
              customerName: manualOrderName,
              total: manualTotal,
              items: manualOrderItems,
              table: manualOrderTable,
              paymentMethod: manualOrderPaymentMethod,
              savings: manualDiscount,
              isOffline: true
            }
          });
        } catch (qErr) {
          const legacy = enqueueOfflineOperation({
            type: 'CREATE_ORDER',
            url: '/owner/orders',
            method: 'POST',
            body: payload
          });
          setOfflineQueueCount(getOfflineQueue().length);
          setManualOrderModalOpen(false);
          setError(`[OFFLINE SAVED] Order queued in memory! (#${legacy.id.slice(-4)})`);
        }
        return;
      }
      setError(err.message || 'Failed to create manual order');
    } finally {
      setSubmittingManualOrder(false);
    }
  }

  function addVariant(name = '', price = '') {
    setItem(prev => ({
      ...prev,
      variants: [
        ...(prev.variants || []),
        { id: `v_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, name, price: price !== '' ? price : (prev.price || '') }
      ]
    }));
  }

  function updateVariant(idx, field, val) {
    setItem(prev => {
      const next = [...(prev.variants || [])];
      next[idx] = { ...next[idx], [field]: val };
      return { ...prev, variants: next };
    });
  }

  function removeVariant(idx) {
    setItem(prev => ({
      ...prev,
      variants: (prev.variants || []).filter((_, i) => i !== idx)
    }));
  }

  function applyVariantPreset(type) {
    const base = Number(item.price) || 200;
    if (type === 'coffee') {
      setItem(prev => ({
        ...prev,
        variants: [
          { id: `v_reg_${Date.now()}`, name: 'Regular (250ml)', price: base },
          { id: `v_lrg_${Date.now()}`, name: 'Large (350ml)', price: base + 40 }
        ]
      }));
    } else if (type === 'pizza') {
      setItem(prev => ({
        ...prev,
        variants: [
          { id: `v_sml_${Date.now()}`, name: 'Personal (7")', price: Math.max(120, base - 50) },
          { id: `v_med_${Date.now()}`, name: 'Medium (10")', price: base },
          { id: `v_lrg_${Date.now()}`, name: 'Large (12")', price: base + 80 }
        ]
      }));
    } else if (type === 'portions') {
      setItem(prev => ({
        ...prev,
        variants: [
          { id: `v_half_${Date.now()}`, name: 'Half Portion', price: Math.round(base * 0.6) },
          { id: `v_full_${Date.now()}`, name: 'Full Portion', price: base }
        ]
      }));
    }
  }

  function addModifierGroup(groupName = 'Choice of Milk', required = false, maxSelect = 1, options = []) {
    setItem(prev => ({
      ...prev,
      modifierGroups: [
        ...(prev.modifierGroups || []),
        {
          id: `mg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: groupName,
          required: Boolean(required),
          minSelect: required ? 1 : 0,
          maxSelect: Number(maxSelect) || 1,
          options: options.length > 0 ? options : [
            { id: `opt_${Date.now()}_1`, name: '', price: 0 }
          ]
        }
      ]
    }));
  }

  function updateModifierGroup(gIdx, field, val) {
    setItem(prev => {
      const next = [...(prev.modifierGroups || [])];
      next[gIdx] = { ...next[gIdx], [field]: val };
      return { ...prev, modifierGroups: next };
    });
  }

  function removeModifierGroup(gIdx) {
    setItem(prev => ({
      ...prev,
      modifierGroups: (prev.modifierGroups || []).filter((_, i) => i !== gIdx)
    }));
  }

  function addGroupOption(gIdx) {
    setItem(prev => {
      const next = [...(prev.modifierGroups || [])];
      const grp = { ...next[gIdx] };
      grp.options = [
        ...(grp.options || []),
        { id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, name: '', price: 0 }
      ];
      next[gIdx] = grp;
      return { ...prev, modifierGroups: next };
    });
  }

  function updateGroupOption(gIdx, oIdx, field, val) {
    setItem(prev => {
      const next = [...(prev.modifierGroups || [])];
      const grp = { ...next[gIdx] };
      const opts = [...(grp.options || [])];
      opts[oIdx] = { ...opts[oIdx], [field]: val };
      grp.options = opts;
      next[gIdx] = grp;
      return { ...prev, modifierGroups: next };
    });
  }

  function removeGroupOption(gIdx, oIdx) {
    setItem(prev => {
      const next = [...(prev.modifierGroups || [])];
      const grp = { ...next[gIdx] };
      grp.options = (grp.options || []).filter((_, i) => i !== oIdx);
      next[gIdx] = grp;
      return { ...prev, modifierGroups: next };
    });
  }

  function applyModifierPreset(type) {
    if (type === 'milk') {
      addModifierGroup('Choice of Milk', false, 1, [
        { id: `opt_oat_${Date.now()}`, name: 'Oat Milk', price: 40 },
        { id: `opt_almond_${Date.now()}`, name: 'Almond Milk', price: 50 },
        { id: `opt_soy_${Date.now()}`, name: 'Soy Milk', price: 30 }
      ]);
    } else if (type === 'syrups') {
      addModifierGroup('Add-ons & Syrups', false, 3, [
        { id: `opt_shot_${Date.now()}`, name: 'Extra Espresso Shot', price: 50 },
        { id: `opt_vanilla_${Date.now()}`, name: 'Madagascar Vanilla Syrup', price: 30 },
        { id: `opt_caramel_${Date.now()}`, name: 'Salted Caramel Drizzle', price: 30 },
        { id: `opt_hazelnut_${Date.now()}`, name: 'Roasted Hazelnut Syrup', price: 30 }
      ]);
    } else if (type === 'toppings') {
      addModifierGroup('Extra Toppings & Cheese', false, 3, [
        { id: `opt_chz_${Date.now()}`, name: 'Extra Mozzarella Cheese', price: 40 },
        { id: `opt_jal_${Date.now()}`, name: 'Pickled Jalapenos', price: 25 },
        { id: `opt_olv_${Date.now()}`, name: 'Black Olives', price: 25 }
      ]);
    } else if (type === 'bread') {
      addModifierGroup('Bread Selection', false, 1, [
        { id: `opt_sd_${Date.now()}`, name: 'Artisan Sourdough', price: 0 },
        { id: `opt_mg_${Date.now()}`, name: 'Multigrain Bread', price: 20 },
        { id: `opt_gf_${Date.now()}`, name: 'Gluten-Free Bread', price: 35 }
      ]);
    }
  }

  function startEditItem(menuItem) {
    setEditingItem(menuItem);
    setItem({
      name: menuItem.name || '',
      description: menuItem.description || '',
      category: menuItem.category || 'Coffee',
      price: menuItem.price !== undefined ? menuItem.price : '',
      veg: menuItem.veg !== undefined ? menuItem.veg : true,
      available: menuItem.available !== undefined ? menuItem.available : true,
      image: menuItem.image || '',
      variants: Array.isArray(menuItem.variants) ? JSON.parse(JSON.stringify(menuItem.variants)) : [],
      modifierGroups: Array.isArray(menuItem.modifierGroups) ? JSON.parse(JSON.stringify(menuItem.modifierGroups)) : []
    });
    setActiveItemModalTab('details');
    setOwnerAddModalOpen(true);
  }

  function cancelEdit() {
    setEditingItem(null);
    setItem({
      name: '',
      description: '',
      category: 'Coffee',
      price: '',
      veg: true,
      available: true,
      image: '',
      variants: [],
      modifierGroups: []
    });
    setActiveItemModalTab('details');
    setOwnerAddModalOpen(false);
  }

  async function saveItem(e) {
    e.preventDefault();
    try {
      const payload = {
        ...item,
        price: Number(item.price) || 0,
        variants: Array.isArray(item.variants)
          ? item.variants
              .filter(v => v.name && v.name.trim())
              .map(v => ({
                id: v.id || `v_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                name: v.name.trim(),
                price: Number(v.price) || 0
              }))
          : [],
        modifierGroups: Array.isArray(item.modifierGroups)
          ? item.modifierGroups
              .filter(g => g.name && g.name.trim())
              .map(g => ({
                id: g.id || `mg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                name: g.name.trim(),
                required: Boolean(g.required),
                minSelect: Number(g.minSelect) || (g.required ? 1 : 0),
                maxSelect: Number(g.maxSelect) || (g.required ? 1 : 1),
                options: Array.isArray(g.options)
                  ? g.options
                      .filter(o => o.name && o.name.trim())
                      .map(o => ({
                        id: o.id || `opt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                        name: o.name.trim(),
                        price: Number(o.price) || 0
                      }))
                  : []
              }))
          : []
      };

      if (editingItem) {
        await api(`/owner/menu/${editingItem._id || editingItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        setEditingItem(null);
        setError('Menu item updated successfully!');
      } else {
        await api('/owner/menu', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setError('New menu item added!');
      }
      setItem({ name: '', description: '', category: 'Coffee', price: '', veg: true, available: true, image: '', variants: [], modifierGroups: [] });
      setActiveItemModalTab('details');
      setOwnerAddModalOpen(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  }


  const filteredOwnerMenu = useMemo(() => {
    let list = data?.cafe?.menu || [];
    if (ownerActiveCategory !== 'All') {
      list = list.filter(i => i.category === ownerActiveCategory);
    }
    if (ownerDietFilter === 'veg') {
      list = list.filter(i => i.veg);
    } else if (ownerDietFilter === 'non-veg') {
      list = list.filter(i => !i.veg);
    } else if (ownerDietFilter === 'live') {
      list = list.filter(i => i.available);
    } else if (ownerDietFilter === 'hidden') {
      list = list.filter(i => !i.available);
    }

    if (ownerSearchQuery.trim()) {
      const q = ownerSearchQuery.toLowerCase().trim();
      list = list.filter(i =>
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q))
      );
    }

    if (ownerSortBy === 'price-asc') {
      list = [...list].sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (ownerSortBy === 'price-desc') {
      list = [...list].sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (ownerSortBy === 'name') {
      list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (ownerSortBy === 'calories') {
      list = [...list].sort((a, b) => parseInt(getFaveItemKcal(a)) - parseInt(getFaveItemKcal(b)));
    }

    return list;
  }, [data?.cafe?.menu, ownerActiveCategory, ownerDietFilter, ownerSearchQuery, ownerSortBy]);

  const ownerCategories = useMemo(() => {
    const cats = new Set();
    (data?.cafe?.menu || []).forEach(i => {
      if (i.category && i.category.trim()) cats.add(i.category.trim());
    });
    // Ensure standard categories exist
    ['Coffee', 'Breakfasts', 'Mains', 'Dessert', 'Beverages'].forEach(c => cats.add(c));
    return ['All', ...Array.from(cats)];
  }, [data?.cafe?.menu]);

  const getCategoryCount = (cat) => {
    if (!data?.cafe?.menu) return 0;
    if (cat === 'All') return data.cafe.menu.length;
    return data.cafe.menu.filter(i => i.category === cat).length;
  };

  async function deleteItem(id) {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await api(`/owner/menu/${id}`, { method: 'DELETE' });
      if (editingItem && editingItem._id === id) {
        cancelEdit();
      }
      load();
      setError('Item deleted successfully.');
    } catch (e) {
      setError(e.message);
    }
  }

  function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setItem(prev => ({ ...prev, image: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  async function toggleItemAvailability(menuItem) {
    try {
      await api(`/owner/menu/${menuItem._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ available: !menuItem.available })
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveLoyalty(e) {
    e.preventDefault();
    try {
      await api('/owner/cafe', { method: 'PATCH', body: JSON.stringify({ loyalty: data.cafe.loyalty }) });
      setError('Loyalty policy updated successfully.');
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveCafeSettings(e) {
    e.preventDefault();
    try {
      await api('/owner/cafe', {
        method: 'PATCH',
        body: JSON.stringify({
          name: data.cafe.name,
          phone: data.cafe.phone,
          address: data.cafe.address,
          tables: Number(data.cafe.tables),
          googleReviewUrl: data.cafe.googleReviewUrl,
          instagramUrl: data.cafe.instagramUrl,
          tagline: data.cafe.tagline,
          brandColor: data.cafe.brandColor,
          wifiSsid: data.cafe.wifiSsid,
          wifiPassword: data.cafe.wifiPassword,
          logo: data.cafe.logo,
          cfdWelcomeTitle: data.cafe.cfdWelcomeTitle,
          cfdWelcomeSubtitle: data.cafe.cfdWelcomeSubtitle,
          cfdPromoBanner: data.cafe.cfdPromoBanner,
          cfdUpiVpa: data.cafe.cfdUpiVpa,
          cfdIdleMedia: data.cafe.cfdIdleMedia,
        })
      });
      setError('Café settings, social links & CFD display updated successfully.');
    } catch (e) {
      setError(e.message);
    }
  }

  // Orders Tab Filtered Query & Status Pipeline
  const ordersTabFiltered = useMemo(() => {
    let list = data?.orders || [];
    if (ordersSearchQuery.trim()) {
      const q = ordersSearchQuery.toLowerCase().trim();
      list = list.filter(o => 
        (o.orderNo || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.phone || '').toLowerCase().includes(q) ||
        String(o.table || '').toLowerCase().includes(q)
      );
    }
    if (ordersStatusTab === 'active') {
      list = list.filter(o => ['placed', 'accepted', 'preparing', 'ready'].includes(o.status));
    } else if (ordersStatusTab === 'incoming') {
      list = list.filter(o => o.status === 'placed' || o.status === 'accepted');
    } else if (ordersStatusTab !== 'all') {
      list = list.filter(o => o.status === ordersStatusTab);
    }
    return list;
  }, [data?.orders, ordersSearchQuery, ordersStatusTab]);

  // Pre-calculate status breakdown for donut chart with timeframe filtering
  const statusStats = useMemo(() => {
    if (!data?.orders) {
      return { total: 12, completed: 8, preparing: 2, pending: 1, cancelled: 1 };
    }
    const orders = data.orders;
    const now = new Date();
    const filteredOrders = orders.filter(o => {
      if (!o.createdAt) return true;
      const orderDate = new Date(o.createdAt);
      if (orderStatusFilter === 'Today') {
        return orderDate.toDateString() === now.toDateString() || (now - orderDate) < 24 * 60 * 60 * 1000;
      }
      if (orderStatusFilter === '7 Days') {
        return (now - orderDate) <= 7 * 24 * 60 * 60 * 1000;
      }
      if (orderStatusFilter === '30 Days') {
        return (now - orderDate) <= 30 * 24 * 60 * 60 * 1000;
      }
      return true;
    });

    const completed = filteredOrders.filter(o => o.status === 'completed').length;
    const preparing = filteredOrders.filter(o => o.status === 'preparing' || o.status === 'ready').length;
    const pending = filteredOrders.filter(o => o.status === 'placed' || o.status === 'accepted').length;
    const cancelled = filteredOrders.filter(o => o.status === 'cancelled').length;
    const sum = completed + preparing + pending + cancelled;
    const total = sum > 0 ? sum : (filteredOrders.length > 0 ? filteredOrders.length : 12);
    return {
      total: total || 1,
      completed: completed || (filteredOrders.length === 0 ? 8 : 0),
      preparing: preparing || (filteredOrders.length === 0 ? 2 : 0),
      pending: pending || (filteredOrders.length === 0 ? 1 : 0),
      cancelled: cancelled || (filteredOrders.length === 0 ? 1 : 0),
    };
  }, [data?.orders, orderStatusFilter]);

  // Dynamic Peak Rush & Hourly Sales Aggregator
  const hourlyRushData = useMemo(() => {
    const slots = [
      { id: '8AM', label: '8 AM', range: '8 AM - 10 AM', hours: [7, 8], name: 'Breakfast Opening' },
      { id: '10AM', label: '10 AM', range: '10 AM - 12 PM', hours: [9, 10], name: 'Mid-Morning Coffee' },
      { id: '12PM', label: '12 PM', range: '12 PM - 2 PM', hours: [11, 12], name: 'Lunch Rush' },
      { id: '2PM', label: '2 PM', range: '2 PM - 4 PM', hours: [13, 14], name: 'Afternoon Turnover' },
      { id: '4PM', label: '4 PM', range: '4 PM - 6 PM', hours: [15, 16], name: 'Tea & Quick Bites' },
      { id: '6PM', label: '6 PM', range: '6 PM - 8 PM', hours: [17, 18], name: 'Evening Peak' },
      { id: '8PM', label: '8 PM', range: '8 PM - 10 PM', hours: [19, 20], name: 'Dinner & Desserts' },
      { id: '10PM', label: '10 PM', range: '10 PM - Close', hours: [21, 22, 23], name: 'Late Night Close' },
    ];

    const baseMap = {
      '8AM': { rev: 280, count: 2 },
      '10AM': { rev: 540, count: 4 },
      '12PM': { rev: 1480, count: 11 },
      '2PM': { rev: 1950, count: 14 },
      '4PM': { rev: 890, count: 7 },
      '6PM': { rev: 720, count: 6 },
      '8PM': { rev: 1180, count: 9 },
      '10PM': { rev: 410, count: 3 },
    };

    const orders = data?.orders || [];
    const now = new Date();

    const filteredOrders = orders.filter(o => {
      if (o.status === 'cancelled') return false;
      if (!o.createdAt) return true;
      const orderDate = new Date(o.createdAt);
      if (revenueFilter === 'Today') {
        const isToday = orderDate.toDateString() === now.toDateString();
        return isToday || (now - orderDate) < 24 * 60 * 60 * 1000;
      }
      if (revenueFilter === '7 Days') {
        return (now - orderDate) <= 7 * 24 * 60 * 60 * 1000;
      }
      if (revenueFilter === '30 Days') {
        return (now - orderDate) <= 30 * 24 * 60 * 60 * 1000;
      }
      return true;
    });

    const slotMetrics = {};
    slots.forEach(s => {
      slotMetrics[s.id] = { rev: 0, count: 0 };
    });

    let hasRealData = false;
    filteredOrders.forEach(o => {
      const d = o.createdAt ? new Date(o.createdAt) : new Date();
      const hour = d.getHours();
      const targetSlot = slots.find(s => s.hours.includes(hour)) || slots[3];
      const amount = Number(o.total || 0);
      slotMetrics[targetSlot.id].rev += amount;
      slotMetrics[targetSlot.id].count += 1;
      if (amount > 0) hasRealData = true;
    });

    const chartBars = slots.map(slot => {
      const real = slotMetrics[slot.id];
      const base = baseMap[slot.id];
      const revenue = hasRealData ? (real.rev > 0 ? real.rev : Math.round(base.rev * 0.2)) : base.rev;
      const orderCount = hasRealData ? (real.count > 0 ? real.count : Math.max(1, Math.round(base.count * 0.2))) : base.count;
      return {
        ...slot,
        revenue,
        orderCount,
      };
    });

    const totalRev = chartBars.reduce((sum, b) => sum + b.revenue, 0);
    const totalOrdersCount = chartBars.reduce((sum, b) => sum + b.orderCount, 0);
    const maxRev = Math.max(...chartBars.map(b => b.revenue), 100);
    const peakSlot = chartBars.reduce((max, b) => (b.revenue > max.revenue ? b : max), chartBars[0]);
    const aov = totalOrdersCount > 0 ? Math.round(totalRev / totalOrdersCount) : 0;
    const peakPct = totalRev > 0 ? Math.round((peakSlot.revenue / totalRev) * 100) : 0;

    return {
      bars: chartBars,
      totalRev,
      totalOrdersCount,
      maxRev,
      peakSlot,
      aov,
      peakPct,
    };
  }, [data?.orders, revenueFilter]);

  // Channel & Kitchen Fulfillment Intelligence
  const fulfillmentMetrics = useMemo(() => {
    const orders = data?.orders || [];
    let dineIn = 0;
    let qrCount = 0;
    let onlineCount = 0;

    orders.forEach(o => {
      const t = (o.table || '').toLowerCase();
      if (t.includes('online')) {
        onlineCount++;
      } else if (t.includes('qr') || t === '1' || t === '2') {
        qrCount++;
      } else {
        dineIn++;
      }
    });

    const total = orders.length || 16;
    if (orders.length === 0) {
      dineIn = 9;
      qrCount = 5;
      onlineCount = 2;
    }
    const dineInPct = Math.round((dineIn / total) * 100);
    const qrPct = Math.round((qrCount / total) * 100);
    const onlinePct = Math.max(0, 100 - dineInPct - qrPct);

    const activeInKitchen = orders.filter(o => o.status === 'placed' || o.status === 'preparing' || o.status === 'ready').length || 3;

    return {
      total,
      dineIn,
      qrCount,
      onlineCount,
      dineInPct,
      qrPct,
      onlinePct,
      activeInKitchen,
      avgPrepTime: '12 min',
      onTimeRate: '96.4%'
    };
  }, [data?.orders]);

  const filteredStaff = useMemo(() => {
    return (staffList || []).filter(member => {
      const q = staffSearch.toLowerCase();
      const matchesSearch =
        !q ||
        member.name?.toLowerCase().includes(q) ||
        member.email?.toLowerCase().includes(q) ||
        member.phone?.includes(q);

      const matchesRole =
        staffRoleFilter === 'all' || member.role === staffRoleFilter;

      const matchesStatus =
        staffStatusFilter === 'all' || member.status === staffStatusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staffList, staffSearch, staffRoleFilter, staffStatusFilter]);

  if (!data) return <div className="loader">{error || 'Loading café dashboard…'}</div>;

  const url = `${location.origin}/c/${data.cafe.slug}`;
  const totalRevenue = data.stats?.todayRevenue ?? 740;
  const totalOrders = data.stats?.todayOrders ?? 12;
  const totalCustomers = data.stats?.totalCustomers ?? (data.customers?.length || 8);
  const pendingBookings = data.stats?.pendingBookings ?? 0;
  const activeOrdersCount = data.orders?.filter(o => o.status === 'placed' || o.status === 'preparing').length || 3;

  // Donut chart angles calculation
  const { total: donutTotal, completed: cCnt, preparing: prepCnt, pending: pendCnt, cancelled: cancCnt } = statusStats;
  const cPct = Math.round((cCnt / donutTotal) * 100) || 67;
  const prepPct = Math.round((prepCnt / donutTotal) * 100) || 17;
  const pendPct = Math.round((pendCnt / donutTotal) * 100) || 8;
  const cancPct = Math.max(0, 100 - cPct - prepPct - pendPct) || 8;

  // SVG Donut calculation
  const circumference = 2 * Math.PI * 52; // radius 52
  const cOffset = 0;
  const prepOffset = -(cPct / 100) * circumference;
  const pendOffset = -((cPct + prepPct) / 100) * circumference;
  const cancOffset = -((cPct + prepPct + pendPct) / 100) * circumference;

  return (
    <div className="owner-root">
      {/* ===================== SIDEBAR ===================== */}
      <aside className={`owner-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand-logo-area">
            <div className="brand-icon-box">
              <img src="/gusstora_emblem.png" alt="Gusstora" className="brand-logo-icon" />
            </div>
            <div className="brand-text">
              <h2>Gusstora</h2>
              <span className="brand-sub">Café Control Centre</span>
            </div>
            <button
              type="button"
              className="owner-mobile-nav-toggle"
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(open => !open)}
            >
              {mobileNavOpen ? <X size={20} /> : <MenuIcon size={20} />}
            </button>
          </div>

          <div className="sidebar-search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search... (Ctrl K)"
              value={navSearchQuery}
              onChange={e => setNavSearchQuery(e.target.value)}
              className="sidebar-search-input"
            />
          </div>

          <nav className="sidebar-nav">
            {filterSidebarNavigation(
              <>
            {/* Kitchen Role View: Direct KDS shortcut */}
            {isKitchen && (
              <button
                className={`nav-item ${tab === 'orders' ? 'active' : ''}`}
                onClick={() => {
                  setTab('orders');
                  setOrderViewMode('kds');
                }}
              >
                <ChefHat size={19} />
                <span>Kitchen Display (KDS)</span>
                {activeOrdersCount > 0 && <span className="nav-badge">{activeOrdersCount}</span>}
              </button>
            )}

            {/* Non-kitchen roles navigation */}
            {!isKitchen && (
              <>
                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'overview' ? 'active' : ''}`}
                    onClick={() => setTab('overview')}
                  >
                    <Home size={19} />
                    <span>Overview</span>
                  </button>
                )}

                <button
                  className={`nav-item ${tab === 'orders' ? 'active' : ''}`}
                  onClick={() => setTab('orders')}
                >
                  <PackageOpen size={19} />
                  <span>{isCashier ? 'Orders (POS)' : 'Orders'}</span>
                  {activeOrdersCount > 0 && <span className="nav-badge">{activeOrdersCount}</span>}
                </button>

                <button
                  type="button"
                  className="nav-item kds-nav-launcher"
                  onClick={() => window.open(data?.cafe?.slug ? `/kds/${data.cafe.slug}` : '/kds', '_blank')}
                  title="Open Dedicated Fullscreen Kitchen Display System in a new tab"
                >
                  <ChefHat size={19} />
                  <span>Kitchen KDS</span>
                  <ExternalLink size={14} style={{ marginLeft: 'auto', opacity: 0.6 }} />
                </button>

                <button
                  className={`nav-item ${tab === 'bookings' ? 'active' : ''}`}
                  onClick={() => setTab('bookings')}
                >
                  <CalendarDays size={19} />
                  <span>Bookings</span>
                  {pendingBookings > 0 && <span className="nav-badge warning">{pendingBookings}</span>}
                </button>

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'menu' ? 'active' : ''}`}
                    onClick={() => setTab('menu')}
                  >
                    <Coffee size={19} />
                    <span>Menu</span>
                  </button>
                )}

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'inventory' ? 'active' : ''}`}
                    onClick={() => setTab('inventory')}
                  >
                    <Boxes size={19} />
                    <span>Inventory & Recipes</span>
                  </button>
                )}

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'enterprise' ? 'active' : ''}`}
                    onClick={() => setTab('enterprise')}
                  >
                    <Globe size={19} />
                    <span>Enterprise & Channels</span>
                  </button>
                )}

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'hardware' ? 'active' : ''}`}
                    onClick={() => setTab('hardware')}
                  >
                    <Printer size={19} />
                    <span>Hardware & Peripherals</span>
                  </button>
                )}

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'gst' ? 'active' : ''}`}
                    onClick={() => setTab('gst')}
                  >
                    <Receipt size={19} />
                    <span>GST & Tally ERP</span>
                  </button>
                )}

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'commissary' ? 'active' : ''}`}
                    onClick={() => setTab('commissary')}
                  >
                    <Truck size={19} />
                    <span>Commissary & Indents</span>
                  </button>
                )}

                <button
                  className={`nav-item ${tab === 'customers' ? 'active' : ''}`}
                  onClick={() => setTab('customers')}
                >
                  <Users size={19} />
                  <span>Customers</span>
                </button>

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setTab('analytics')}
                  >
                    <BarChart3 size={19} />
                    <span>Analytics</span>
                  </button>
                )}

                <button
                  className={`nav-item ${tab === 'rewards' ? 'active' : ''}`}
                  onClick={() => {
                    setTab('rewards');
                    setVerifiedReward(null);
                  }}
                >
                  <Gift size={19} />
                  <span>Redeem Rewards</span>
                  {data.stats?.activeRewards > 0 && <span className="nav-badge success">{data.stats.activeRewards}</span>}
                </button>

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'loyalty' ? 'active' : ''}`}
                    onClick={() => setTab('loyalty')}
                  >
                    <QrCode size={19} />
                    <span>Loyalty & QR</span>
                  </button>
                )}

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'staff' ? 'active' : ''}`}
                    onClick={() => {
                      setTab('staff');
                      fetchStaff();
                    }}
                  >
                    <ShieldCheck size={19} />
                    <span>Staff & Roles</span>
                    {staffList?.length > 0 && <span className="nav-badge">{staffList.length}</span>}
                  </button>
                )}

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'staff-ops' ? 'active' : ''}`}
                    onClick={() => setTab('staff-ops')}
                  >
                    <UserCheck size={19} />
                    <span>Staff Ops & Tips</span>
                    <span className="nav-badge success">NEW</span>
                  </button>
                )}

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'ai-roastery' ? 'active' : ''}`}
                    onClick={() => setTab('ai-roastery')}
                  >
                    <Sparkles size={19} />
                    <span>AI Roastery OS</span>
                    <span className="nav-badge success">AI</span>
                  </button>
                )}

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'reminders' ? 'active' : ''}`}
                    onClick={() => {
                      setTab('reminders');
                      fetchReminders();
                    }}
                  >
                    <Bell size={19} />
                    <span>Reminders</span>
                    {reminderSummary?.readyAudience > 0 && <span className="nav-badge success">{reminderSummary.readyAudience}</span>}
                  </button>
                )}

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'feedback' ? 'active' : ''}`}
                    onClick={() => {
                      setTab('feedback');
                      fetchFeedback();
                    }}
                  >
                    <Star size={19} />
                    <span>Reviews & Booster</span>
                    {feedbackStats?.unresolvedCount > 0 && (
                      <span className="nav-badge warning">{feedbackStats.unresolvedCount}</span>
                    )}
                  </button>
                )}

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'qr-kit' ? 'active' : ''}`}
                    onClick={() => setTab('qr-kit')}
                  >
                    <QrCode size={19} />
                    <span>QR Table Kit</span>
                    <span className="nav-badge success">{data?.cafe?.tables || 12} QRs</span>
                  </button>
                )}

                {(isOwner || isManager) && (
                  <button
                    className={`nav-item ${tab === 'security' ? 'active' : ''}`}
                    onClick={() => {
                      setTab('security');
                      fetchAuditLogs(1);
                      fetchSessions();
                    }}
                  >
                    <ShieldCheck size={19} />
                    <span>Security & Audit</span>
                    {auditStats?.criticalActionsCount > 0 && (
                      <span className="nav-badge warning">{auditStats.criticalActionsCount} alerts</span>
                    )}
                  </button>
                )}

                {isOwner && (
                  <button
                    className={`nav-item ${tab === 'settings' ? 'active' : ''}`}
                    onClick={() => setTab('settings')}
                  >
                    <Settings size={19} />
                    <span>Settings</span>
                  </button>
                )}
              </>
            )}
              </>,
              navSearchQuery
            )}
          </nav>
        </div>

        {/* Sidebar Promo Card & User Strip */}
        <div className="sidebar-bottom">
          <div className="sidebar-pro-card" onClick={() => setTab('settings')}>
            <div className="pro-icon-box">
              <Crown size={15} />
            </div>
            <div className="pro-content">
              <span className="pro-title">Pro Plan · Active</span>
              <span className="pro-sub">Expires in 28 days</span>
            </div>
            <ChevronRight size={14} className="pro-arrow" />
          </div>

          <div className="sidebar-user-strip">
            <div className="sidebar-user-avatar">
              {(data?.user?.name?.[0] || 'A').toUpperCase()}
            </div>
            <div className="sidebar-user-meta">
              <span className="sidebar-user-name">{data?.user?.name || 'Akash Jha'}</span>
              <span className="sidebar-user-role">{userRole ? userRole.toUpperCase() : 'OWNER'}</span>
            </div>
            <button
              type="button"
              className="sidebar-logout-icon-btn"
              title="Sign out"
              onClick={async () => {
                await logoutUser();
                nav('/owner/login');
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
      {mobileNavOpen && (
        <button
          type="button"
          className="owner-mobile-nav-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ===================== MAIN CONTENT AREA ===================== */}
      <main className="owner-main">
        {/* Top Header Bar */}
        <header className="owner-header">
          <div className="header-greeting">
            <span className="greeting-sub">Good morning,</span>
            <h1 className="greeting-title">
              {data.user?.name || 'Staff'}
            </h1>
            <p className="greeting-desc">
              {isKitchen
                ? 'Live Kitchen Display System (KDS) order board.'
                : isCashier
                ? 'Front-of-house point of sale & customer service.'
                : "Here's what's happening at your café today."}
            </p>
          </div>

          <div className="header-actions">
            {/* Phase 7: Offline POS Resilience Network Status & Outbox Modal Trigger */}
            <div
              className={`pos-network-pill ${isOnline ? 'online' : 'offline'}`}
              title="Click to inspect offline outbox queue & force reconciliation"
              onClick={() => setShowOfflineSyncModal(true)}
              style={{ cursor: 'pointer' }}
            >
              {isOnline ? (
                <>
                  <Wifi size={14} className="header-status-icon" />
                  <span>{offlineQueueCount > 0 ? `Outbox (${offlineQueueCount})` : 'Online'}</span>
                </>
              ) : (
                <>
                  <WifiOff size={14} className="header-status-icon" />
                  <span>Offline ({offlineQueueCount})</span>
                </>
              )}
            </div>

            {/* Phase 7: Dual-Screen Customer Facing Display (CFD) Launcher */}
            <button
              type="button"
              className="pos-cfd-header-btn"
              onClick={() => window.open(data?.cafe?.slug ? `/cfd/${data.cafe.slug}` : '/cfd', '_blank')}
              title="Launch Dual-Screen Customer Facing Display (CFD) on secondary monitor"
            >
              <Monitor size={14} />
              <span>CFD Display</span>
            </button>

            {/* Phase 8: Waiter Captain Floor Management Launcher */}
            <button
              type="button"
              className="pos-captain-header-btn"
              onClick={() => window.open(data?.cafe?.slug ? `/captain/${data.cafe.slug}` : '/captain', '_blank')}
              title="Launch Waiter Captain App & Interactive Floor Management"
            >
              <Smartphone size={14} />
              <span>Captain App</span>
            </button>

            {/* Phase 9: Indian Tax Compliance, GST Invoicing & Tally ERP Launcher */}
            {(isOwner || isManager) && (
              <button
                type="button"
                className={`pos-cfd-header-btn ${tab === 'gst' ? 'active' : ''}`}
                onClick={() => setTab('gst')}
                title="Indian Tax Compliance, GST Invoicing & Tally ERP 9 / Prime Sync"
              >
                <Receipt size={14} />
                <span>GST & Tally</span>
              </button>
            )}

            {/* 0. Register Shift Pill (Phase 2 Cashier & Day-End Controls) */}
            <div className="header-action-container header-shift-container">
              <button
                type="button"
                className={`header-shift-pill ${headerShiftDropdownOpen ? 'open' : ''}`}
                onClick={() => {
                  setHeaderShiftDropdownOpen(prev => !prev);
                  setHeaderDateDropdownOpen(false);
                  setHeaderNotifDropdownOpen(false);
                  setHeaderProfileDropdownOpen(false);
                }}
                title={currentShiftData ? `Active Shift: ${currentShiftData.shiftCode || 'OPEN'}` : 'Register Closed - Click to Open Shift'}
              >
                <span className={`shift-status-dot ${currentShiftData ? 'active' : 'closed'}`} />
                <Coins size={14} className="shift-icon" />
                <span>
                  {currentShiftData
                    ? `Shift #${currentShiftData.shiftCode || 'Active'}`
                    : 'Register Closed'}
                </span>
                <ChevronDown size={13} className="chevron" />
              </button>

              {headerShiftDropdownOpen && (
                <div className="header-dropdown-menu shift-popover">
                  <div className="popover-title-row">
                    <div className="popover-title-flex">
                      <Coins size={16} style={{ color: '#176B50' }} />
                      <span className="popover-heading">
                        {currentShiftData ? 'Active Cash Register' : 'Register Status'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="popover-close-btn"
                      onClick={() => setHeaderShiftDropdownOpen(false)}
                      title="Close"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {currentShiftData ? (
                    <>
                      <div className="shift-popover-info">
                        <div className="shift-popover-row">
                          <span>Cashier on Duty:</span>
                          <b>{currentShiftData.cashierName || currentUser?.name || 'Cashier'}</b>
                        </div>
                        <div className="shift-popover-row">
                          <span>Opened:</span>
                          <b>{new Date(currentShiftData.openedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</b>
                        </div>
                        <div className="shift-popover-row">
                          <span>Opening Float:</span>
                          <b>₹{(currentShiftData.openingFloat || 0).toLocaleString('en-IN')}</b>
                        </div>
                        {currentShiftData.summary && (
                          <>
                            <div className="shift-popover-row">
                              <span>Cash Collected:</span>
                              <b>₹{(currentShiftData.summary.cashCollected || 0).toLocaleString('en-IN')}</b>
                            </div>
                            <div className="shift-popover-row">
                              <span>Expected in Drawer:</span>
                              <b style={{ color: '#176B50' }}>
                                ₹{(currentShiftData.summary.closingFloatExpected || currentShiftData.summary.expectedCashInDrawer || 0).toLocaleString('en-IN')}
                              </b>
                            </div>
                            <div className="shift-popover-row">
                              <span>Total Net Sales:</span>
                              <b>₹{(currentShiftData.summary.netSales || 0).toLocaleString('en-IN')}</b>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="shift-popover-actions">
                        <button
                          type="button"
                          className="crm-btn-primary"
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => {
                            setHeaderShiftDropdownOpen(false);
                            setShiftModalMode('close');
                            setClosingCountedInput(
                              currentShiftData.summary
                                ? String(currentShiftData.summary.closingFloatExpected || currentShiftData.summary.expectedCashInDrawer || '')
                                : ''
                            );
                          }}
                        >
                          <Lock size={14} />
                          <span>Close Shift & Day-End Z-Report</span>
                        </button>
                        <button
                          type="button"
                          className="crm-btn-secondary"
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => {
                            setHeaderShiftDropdownOpen(false);
                            fetchShiftsHistory();
                            setShiftModalMode('history');
                          }}
                        >
                          <History size={14} />
                          <span>Past Shifts & Z-Reports</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="shift-popover-info" style={{ textAlign: 'center', padding: '16px 12px' }}>
                        <Lock size={24} style={{ color: '#9ca3af', margin: '0 auto 8px' }} />
                        <h4 style={{ margin: '0 0 4px', fontSize: 14, color: '#1a120c' }}>Register is Closed</h4>
                        <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                          Open a shift with cash float to start tracking drawer sales and balance Day-End Z-reports.
                        </p>
                      </div>

                      <div className="shift-popover-actions">
                        <button
                          type="button"
                          className="crm-btn-primary"
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => {
                            setHeaderShiftDropdownOpen(false);
                            setShiftModalMode('open');
                          }}
                        >
                          <Plus size={14} />
                          <span>Open Register Shift</span>
                        </button>
                        <button
                          type="button"
                          className="crm-btn-secondary"
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => {
                            setHeaderShiftDropdownOpen(false);
                            fetchShiftsHistory();
                            setShiftModalMode('history');
                          }}
                        >
                          <History size={14} />
                          <span>Past Shifts History</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 1. Date Pill Button with Quick Day Switcher & Date Picker Popover */}
            <div className="header-action-container header-date-container">
              <button
                type="button"
                className={`header-date-pill ${headerDateDropdownOpen ? 'open' : ''}`}
                onClick={() => {
                  setHeaderDateDropdownOpen(prev => !prev);
                  setHeaderNotifDropdownOpen(false);
                  setHeaderProfileDropdownOpen(false);
                }}
                title="Click to change operational date or view day summary"
              >
                <Calendar size={15} className="date-icon" />
                <span>{new Date(bookingDate || new Date()).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <ChevronDown size={13} className="chevron" />
              </button>

              {headerDateDropdownOpen && (
                <div className="header-dropdown-menu date-popover">
                  <div className="popover-title-row">
                    <div className="popover-title-flex">
                      <Calendar size={16} style={{ color: '#176B50' }} />
                      <span className="popover-heading">Operational Date</span>
                    </div>
                    <button
                      type="button"
                      className="popover-close-btn"
                      onClick={() => setHeaderDateDropdownOpen(false)}
                      title="Close"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="date-quick-buttons">
                    <button
                      type="button"
                      className={`date-quick-btn ${bookingDate === new Date().toISOString().split('T')[0] ? 'active' : ''}`}
                      onClick={() => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        setBookingDate(todayStr);
                        fetchBookings(todayStr);
                      }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className="date-quick-btn"
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const tmrwStr = tomorrow.toISOString().split('T')[0];
                        setBookingDate(tmrwStr);
                        fetchBookings(tmrwStr);
                      }}
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      className="date-quick-btn"
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        const yestStr = yesterday.toISOString().split('T')[0];
                        setBookingDate(yestStr);
                        fetchBookings(yestStr);
                      }}
                    >
                      Yesterday
                    </button>
                  </div>

                  <div className="date-picker-custom-row">
                    <label>Select Custom Date</label>
                    <input
                      type="date"
                      className="date-picker-input"
                      value={bookingDate}
                      onChange={e => {
                        setBookingDate(e.target.value);
                        fetchBookings(e.target.value);
                      }}
                    />
                  </div>

                  <div className="date-metrics-box">
                    <div className="metric-pill-item">
                      <span className="metric-lbl">Orders</span>
                      <span className="metric-num">{data?.stats?.todayOrders || (data.orders || []).length || 0}</span>
                    </div>
                    <div className="metric-pill-item">
                      <span className="metric-lbl">Reservations</span>
                      <span className="metric-num">{bookingsList?.length || 0}</span>
                    </div>
                    <div className="metric-pill-item">
                      <span className="metric-lbl">Seated</span>
                      <span className="metric-num">{(tablesList || []).filter(t => t.status === 'occupied').length} Tables</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="popover-action-footer-btn"
                    onClick={() => {
                      setTab('bookings');
                      setFloorViewMode('reservations');
                      setHeaderDateDropdownOpen(false);
                    }}
                  >
                    <span>View Day Reservations</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* 2. Notification Bell Button with Live Operational Popover */}
            <div className="header-action-container header-notif-container">
              <button
                type="button"
                className={`header-icon-circle-btn ${headerNotifDropdownOpen ? 'open' : ''}`}
                onClick={() => {
                  setHeaderNotifDropdownOpen(prev => !prev);
                  setHeaderDateDropdownOpen(false);
                  setHeaderProfileDropdownOpen(false);
                }}
                title="Notifications & Operational Alerts"
              >
                <Bell size={18} />
                {!notificationsRead && headerNotifications.length > 0 && (
                  <span className="notif-indicator"></span>
                )}
              </button>

              {headerNotifDropdownOpen && (
                <div className="header-dropdown-menu notif-popover">
                  <div className="popover-title-row">
                    <div className="popover-title-flex">
                      <Bell size={16} style={{ color: '#176B50' }} />
                      <span className="popover-heading">Notifications</span>
                      {headerNotifications.length > 0 && (
                        <span className="notif-count-pill">{headerNotifications.length}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {headerNotifications.length > 0 && !notificationsRead && (
                        <button
                          type="button"
                          className="notif-clear-text-btn"
                          onClick={() => setNotificationsRead(true)}
                        >
                          Mark read
                        </button>
                      )}
                      <button
                        type="button"
                        className="popover-close-btn"
                        onClick={() => setHeaderNotifDropdownOpen(false)}
                        title="Close"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="notif-items-list">
                    {headerNotifications.length === 0 ? (
                      <div className="notif-empty-state">
                        <CheckCircle2 size={32} style={{ color: '#10b981', opacity: 0.8 }} />
                        <h4>All caught up!</h4>
                        <p>No active operational alerts or pending items right now.</p>
                      </div>
                    ) : (
                      headerNotifications.map(n => {
                        const IconComp = n.icon;
                        return (
                          <div
                            key={n.id}
                            className="notif-item-card"
                            onClick={n.action}
                          >
                            <div
                              className="notif-icon-box"
                              style={{ background: `${n.color}18`, color: n.color }}
                            >
                              <IconComp size={16} />
                            </div>
                            <div className="notif-content-col">
                              <div className="notif-item-title-row">
                                <span className="notif-item-title">{n.title}</span>
                                <span className="notif-item-time">{n.time}</span>
                              </div>
                              <div className="notif-item-desc">{n.desc}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="notif-footer-row">
                    <button
                      type="button"
                      className="notif-footer-link"
                      onClick={() => {
                        setTab('orders');
                        setHeaderNotifDropdownOpen(false);
                      }}
                    >
                      <span>Live Orders</span>
                      <ChevronRight size={13} />
                    </button>
                    <button
                      type="button"
                      className="notif-footer-link"
                      onClick={() => {
                        setTab('security');
                        setHeaderNotifDropdownOpen(false);
                      }}
                    >
                      <span>Security Logs</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Profile Chip with Account & Café Management Popover */}
            <div className="header-action-container header-profile-container">
              <div
                className={`header-profile-chip ${headerProfileDropdownOpen ? 'open' : ''}`}
                onClick={() => {
                  setHeaderProfileDropdownOpen(prev => !prev);
                  setHeaderDateDropdownOpen(false);
                  setHeaderNotifDropdownOpen(false);
                }}
                title="Account & Café Menu"
              >
                <div
                  className="profile-avatar-initial"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#176B50',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: '700',
                    fontSize: '12px'
                  }}
                >
                  {(data.user?.name?.[0] || 'U').toUpperCase()}
                </div>
                <div className="profile-info">
                  <span className="profile-name">{data.user?.name || 'Staff User'}</span>
                  <span className={`role-badge ${userRole}`}>{userRole}</span>
                </div>
                <ChevronDown size={13} className="profile-chevron" />
              </div>

              {headerProfileDropdownOpen && (
                <div className="header-dropdown-menu profile-popover">
                  {/* User Profile Card */}
                  <div className="profile-popover-user-card">
                    <div
                      className="profile-avatar-initial large"
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: isOwner ? '#176B50' : isManager ? '#3b82f6' : isCashier ? '#10b981' : '#f59e0b',
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: '700',
                        fontSize: '16px',
                        flexShrink: 0
                      }}
                    >
                      {(data.user?.name?.[0] || 'U').toUpperCase()}
                    </div>
                    <div className="profile-popover-user-details">
                      <div className="profile-user-fullname">{data.user?.name || 'Staff User'}</div>
                      <div className="profile-user-email">{data.user?.email || currentUser?.email || 'staff@perkbyte.com'}</div>
                      <span className={`role-badge ${userRole}`} style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {userRole === 'owner' ? <><Crown size={11} /> OWNER</> : userRole === 'manager' ? <><ClipboardList size={11} /> MANAGER</> : userRole === 'cashier' ? <><CreditCard size={11} /> CASHIER</> : <><ChefHat size={11} /> KITCHEN</>}
                      </span>
                    </div>
                  </div>

                  {/* Cafe Box */}
                  <div className="profile-popover-cafe-box">
                    <Coffee size={14} className="cafe-box-ico" />
                    <div className="cafe-box-txt">
                      <span className="cafe-box-name">{data.cafe?.name || 'The Daily Grind'}</span>
                      <span className="cafe-box-sub">{data.cafe?.slug ? `perkbyte.com/c/${data.cafe.slug}` : 'Digital Loyalty Suite'}</span>
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="profile-menu-links">
                    <button
                      type="button"
                      className="profile-menu-item"
                      onClick={() => {
                        setTab('settings');
                        setHeaderProfileDropdownOpen(false);
                      }}
                    >
                      <Settings size={15} />
                      <span>Café & Account Settings</span>
                    </button>

                    <button
                      type="button"
                      className="profile-menu-item"
                      onClick={() => {
                        setTab('security');
                        setHeaderProfileDropdownOpen(false);
                      }}
                    >
                      <ShieldCheck size={15} />
                      <span>Security & Active Sessions</span>
                    </button>

                    {(isOwner || isManager) && (
                      <button
                        type="button"
                        className="profile-menu-item"
                        onClick={() => {
                          setTab('staff');
                          setHeaderProfileDropdownOpen(false);
                        }}
                      >
                        <Users size={15} />
                        <span>Staff Management</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="profile-menu-item"
                      onClick={() => {
                        setTab('bookings');
                        setHeaderProfileDropdownOpen(false);
                      }}
                    >
                      <Armchair size={15} />
                      <span>Floor Plan & Tables</span>
                    </button>

                    {data.cafe?.slug && (
                      <a
                        href={`/c/${data.cafe.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="profile-menu-item external"
                        onClick={() => setHeaderProfileDropdownOpen(false)}
                      >
                        <Globe size={15} />
                        <span>Customer Menu & QR</span>
                        <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
                      </a>
                    )}
                  </div>

                  <div className="profile-popover-divider"></div>

                  <button
                    type="button"
                    className="profile-popover-signout"
                    onClick={async () => {
                      setHeaderProfileDropdownOpen(false);
                      await logoutUser();
                      nav('/owner/login');
                    }}
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Phase 3: Offline Alert Banner */}
        {(!isOnline || offlineQueueCount > 0) && (
          <div className="pos-offline-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WifiOff size={16} />
              <span>
                {!isOnline
                  ? `Offline Mode Active: Orders & payments will be queued locally (${offlineQueueCount} pending) and auto-synced when connection recovers.`
                  : `Online Reconnected: ${offlineQueueCount} offline actions pending cloud synchronization.`}
              </span>
            </div>
            {isOnline && offlineQueueCount > 0 && (
              <button
                type="button"
                className="offline-sync-btn"
                onClick={triggerOfflineSync}
                disabled={syncingOffline}
              >
                <RefreshCw size={12} className={syncingOffline ? 'spin' : ''} />
                <span>{syncingOffline ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="theme-toast" onClick={() => setError('')}>
            <span>{error}</span>
            <X size={16} />
          </div>
        )}

        {/* ===================== TAB: OVERVIEW (EXECUTIVE CAFE PULSE) ===================== */}
        {tab === 'overview' && (
          <div className="crm-orders-wrapper owner-overview" style={{ padding: '0 0 40px 0' }}>
            {/* 1. Operational Overview Header Card */}
            <div className="crm-orders-header-card owner-pulse-banner">
              <div className="crm-orders-header-left">
                <div className="crm-orders-brand-emblem">
                  <Coffee size={24} style={{ color: '#DCEFE4' }} />
                </div>
                <div className="crm-orders-brand-info">
                  <div className="crm-orders-tag-row">
                    <span className="crm-orders-tag">BUSINESS INSIGHTS</span>
                  </div>
                  <div className="crm-orders-title-row">
                    <h1 className="crm-orders-title">{data?.cafe?.name || 'Gusstora'} Executive Pulse</h1>
                    <span className="crm-menu-status-badge">
                      <span className="crm-pulse-dot" />
                      Live Venue Analytics
                    </span>
                  </div>
                  <p className="crm-orders-subtitle">
                    Real-time revenue, order fulfillment velocity, peak dining hours & floor table occupancy
                  </p>
                </div>
              </div>

              <div className="crm-orders-header-actions">
                <button
                  type="button"
                  className="crm-btn-secondary owner-pulse-primary"
                  onClick={() => setTab('orders')}
                >
                  <PackageOpen size={16} />
                  <span>Orders POS</span>
                </button>
                <button
                  type="button"
                  className="crm-btn-primary owner-pulse-secondary"
                  onClick={() => setTab('bookings')}
                >
                  <Calendar size={16} />
                  <span>Floor Tables</span>
                </button>
              </div>
            </div>

            {/* ROW 1: 4 STAT CARDS */}
            <div className="stats-cards-grid">
              {/* Card 1: Today's Revenue */}
              <div className="stat-card">
                <div className="stat-card-top">
                  <div className="stat-icon-wrap coral">
                    <Coins size={22} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Today's Revenue</span>
                    <h3 className="stat-value">{money(totalRevenue)}</h3>
                  </div>
                </div>
                <div className="stat-card-bottom">
                  <span className="stat-trend positive">
                    <TrendingUp size={13} /> +12% <small>vs yesterday</small>
                  </span>
                  <svg className="kpi-sparkline coral" viewBox="0 0 82 28">
                    <path className="spark-area" d="M 0 24 Q 20 22, 35 14 T 65 6 T 82 2 L 82 28 L 0 28 Z" />
                    <path className="spark-line" d="M 0 24 Q 20 22, 35 14 T 65 6 T 82 2" />
                  </svg>
                </div>
              </div>

              {/* Card 2: Today's Orders */}
              <div className="stat-card">
                <div className="stat-card-top">
                  <div className="stat-icon-wrap mint">
                    <ShoppingCart size={22} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Today's Orders</span>
                    <h3 className="stat-value">{totalOrders}</h3>
                  </div>
                </div>
                <div className="stat-card-bottom">
                  <span className="stat-trend positive">
                    <TrendingUp size={13} /> +3 <small>vs yesterday</small>
                  </span>
                  <svg className="kpi-sparkline mint" viewBox="0 0 82 28">
                    <path className="spark-area" d="M 0 20 Q 25 24, 40 10 T 65 12 T 82 4 L 82 28 L 0 28 Z" />
                    <path className="spark-line" d="M 0 20 Q 25 24, 40 10 T 65 12 T 82 4" />
                  </svg>
                </div>
              </div>

              {/* Card 3: Total Customers */}
              <div className="stat-card">
                <div className="stat-card-top">
                  <div className="stat-icon-wrap soft-sage">
                    <Users size={22} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Total Customers</span>
                    <h3 className="stat-value">{totalCustomers}</h3>
                  </div>
                </div>
                <div className="stat-card-bottom">
                  <span className="stat-trend positive">
                    <TrendingUp size={13} /> +2 <small>new today</small>
                  </span>
                  <svg className="kpi-sparkline sage" viewBox="0 0 82 28">
                    <path className="spark-area" d="M 0 22 Q 20 18, 42 12 T 68 8 T 82 3 L 82 28 L 0 28 Z" />
                    <path className="spark-line" d="M 0 22 Q 20 18, 42 12 T 68 8 T 82 3" />
                  </svg>
                </div>
              </div>

              {/* Card 4: Booking Requests */}
              <div className="stat-card">
                <div className="stat-card-top">
                  <div className="stat-icon-wrap amber">
                    <Calendar size={22} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Booking Requests</span>
                    <h3 className="stat-value">{pendingBookings}</h3>
                  </div>
                </div>
                <div className="stat-card-bottom">
                  <span className="stat-trend neutral">Awaiting confirmation</span>
                  <svg className="kpi-sparkline amber" viewBox="0 0 82 28">
                    <path className="spark-area" d="M 0 16 Q 22 8, 44 18 T 66 10 T 82 6 L 82 28 L 0 28 Z" />
                    <path className="spark-line" d="M 0 16 Q 22 8, 44 18 T 66 10 T 82 6" />
                  </svg>
                </div>
              </div>
            </div>

            {/* ROW 2: CHARTS SPLIT (REVENUE OVERVIEW + ORDER STATUS) */}
            <div className="charts-split-grid">
              {/* Left Chart: Peak Rush & Hourly Sales */}
              <div className="hourly-rush-chart-card">
                <div className="rush-chart-header">
                  <div>
                    <div className="rush-title-row">
                      <h3 className="rush-chart-title">Peak Rush & Hourly Sales</h3>
                      <span className="rush-live-indicator">
                        <span className="live-pulse-dot"></span>
                        Live Velocity
                      </span>
                    </div>
                    <p className="rush-chart-sub">
                      Tracking {hourlyRushData.totalOrdersCount} orders (₹{hourlyRushData.totalRev.toLocaleString('en-IN')}) across operational hours
                    </p>
                  </div>

                  <div className="rush-filter-actions">
                    <div className="rush-filter-pills">
                      {['Today', '7 Days', '30 Days'].map(filterOption => (
                        <button
                          key={filterOption}
                          type="button"
                          className={`rush-filter-btn ${revenueFilter === filterOption ? 'active' : ''}`}
                          onClick={() => setRevenueFilter(filterOption)}
                        >
                          {filterOption}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Peak Velocity Alert Strip */}
                <div className="rush-peak-banner">
                  <div className="rush-peak-icon-wrap">
                    <Flame size={16} />
                  </div>
                  <div className="rush-peak-text-wrap">
                    <span className="rush-peak-lead">Peak Rush Window:</span>
                    <strong className="rush-peak-time">{hourlyRushData.peakSlot.range} ({hourlyRushData.peakSlot.name})</strong>
                    <span className="rush-peak-metric"> · ₹{hourlyRushData.peakSlot.revenue.toLocaleString('en-IN')} across {hourlyRushData.peakSlot.orderCount} orders ({hourlyRushData.peakPct}% of sales)</span>
                  </div>
                  <span className="rush-highest-turnover-tag">Highest Velocity</span>
                </div>

                {/* Histogram Visualizer with Reference Guides & Tooltip */}
                <div className="rush-histogram-container">
                  {/* Reference Guides */}
                  <div className="rush-grid-guides">
                    <div className="rush-grid-line"><span>₹{hourlyRushData.maxRev.toLocaleString('en-IN')}</span></div>
                    <div className="rush-grid-line"><span>₹{Math.round(hourlyRushData.maxRev * 0.5).toLocaleString('en-IN')}</span></div>
                    <div className="rush-grid-line"><span>₹0</span></div>
                  </div>

                  {/* Bars Flex Columns */}
                  <div className="rush-bars-track">
                    {hourlyRushData.bars.map((bar) => {
                      const heightPercent = Math.max(12, Math.round((bar.revenue / hourlyRushData.maxRev) * 100));
                      const isPeak = bar.id === hourlyRushData.peakSlot.id;
                      const isHovered = hoveredRushSlot === bar.id;

                      return (
                        <div
                          key={bar.id}
                          className={`rush-bar-column ${isPeak ? 'peak-bar' : ''} ${isHovered ? 'hovered' : ''}`}
                          onMouseEnter={() => setHoveredRushSlot(bar.id)}
                          onMouseLeave={() => setHoveredRushSlot(null)}
                        >
                          {/* Interactive Tooltip on Hover */}
                          {isHovered && (
                            <div className="rush-bar-tooltip">
                              <div className="rush-tt-time">{bar.range}</div>
                              <div className="rush-tt-rev">₹{bar.revenue.toLocaleString('en-IN')}</div>
                              <div className="rush-tt-meta">{bar.orderCount} orders · {bar.name}</div>
                            </div>
                          )}

                          {isPeak && (
                            <div className="rush-peak-badge">
                              <Flame size={10} />
                              <span>PEAK</span>
                            </div>
                          )}

                          <div className="rush-bar-track">
                            <div
                              className="rush-bar-fill"
                              style={{ height: `${heightPercent}%` }}
                            >
                              <div className="rush-bar-glow"></div>
                            </div>
                          </div>

                          <span className="rush-slot-label">{bar.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Operational KPI Matrix */}
                <div className="rush-bottom-metrics">
                  <div className="rush-metric-tile">
                    <div className="rush-tile-icon-box blue">
                      <TrendingUp size={15} />
                    </div>
                    <div className="rush-tile-content">
                      <span className="rush-tile-label">Peak Velocity</span>
                      <strong className="rush-tile-val">₹{hourlyRushData.peakSlot.revenue.toLocaleString('en-IN')} <small>/ slot</small></strong>
                    </div>
                  </div>

                  <div className="rush-metric-tile">
                    <div className="rush-tile-icon-box emerald">
                      <Coins size={15} />
                    </div>
                    <div className="rush-tile-content">
                      <span className="rush-tile-label">Avg. Ticket (AOV)</span>
                      <strong className="rush-tile-val">₹{hourlyRushData.aov} <small>/ order</small></strong>
                    </div>
                  </div>

                  <div className="rush-metric-tile">
                    <div className="rush-tile-icon-box amber">
                      <Zap size={15} />
                    </div>
                    <div className="rush-tile-content">
                      <span className="rush-tile-label">Rush Intensity</span>
                      <strong className="rush-tile-val">{hourlyRushData.peakSlot.orderCount} orders <small>({hourlyRushData.peakPct}% vol)</small></strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Chart: Order Status */}
              <div className="white-donut-card">
                <div className="donut-card-header">
                  <div>
                    <h3 className="donut-card-title">Order Status</h3>
                    <p className="donut-card-sub">Total orders across all channels</p>
                  </div>
                  <div className="chart-dropdown-wrap" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="chart-dropdown-pill light"
                      onClick={() => setOrderStatusDropdownOpen(prev => !prev)}
                      style={{ cursor: 'pointer', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#334155' }}
                    >
                      <span>{orderStatusFilter}</span>
                      <ChevronDown size={14} style={{ transform: orderStatusDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                    </button>
                    {orderStatusDropdownOpen && (
                      <div
                        className="chart-dropdown-menu"
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 'calc(100% + 4px)',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                          zIndex: 50,
                          minWidth: '110px',
                          padding: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        {['Today', '7 Days', '30 Days'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            className={orderStatusFilter === opt ? 'active' : ''}
                            onClick={() => {
                              setOrderStatusFilter(opt);
                              setOrderStatusDropdownOpen(false);
                            }}
                            style={{
                              background: orderStatusFilter === opt ? '#f1f5f9' : 'transparent',
                              color: orderStatusFilter === opt ? '#0f172a' : '#64748b',
                              fontWeight: orderStatusFilter === opt ? 700 : 500,
                              border: 'none',
                              textAlign: 'left',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              width: '100%'
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="donut-body">
                  {/* SVG Donut Graphic */}
                  <div className="donut-graphic-wrap">
                    <svg viewBox="0 0 140 140" className="donut-svg">
                      {/* Background base track */}
                      <circle
                        cx="70"
                        cy="70"
                        r="52"
                        fill="transparent"
                        stroke="#E4EAE5"
                        strokeWidth="15"
                      />

                      {/* Completed Segment (Emerald) */}
                      <circle
                        cx="70"
                        cy="70"
                        r="52"
                        fill="transparent"
                        stroke="#16A579"
                        strokeWidth="15"
                        strokeDasharray={`${(cPct / 100) * circumference} ${circumference}`}
                        strokeDashoffset={cOffset}
                        strokeLinecap="round"
                        transform="rotate(-90 70 70)"
                      />

                      {/* Preparing Segment (Orange) */}
                      <circle
                        cx="70"
                        cy="70"
                        r="52"
                        fill="transparent"
                        stroke="#F28A45"
                        strokeWidth="15"
                        strokeDasharray={`${(prepPct / 100) * circumference} ${circumference}`}
                        strokeDashoffset={prepOffset}
                        strokeLinecap="round"
                        transform="rotate(-90 70 70)"
                      />

                      {/* Pending Segment (Soft Coral Red) */}
                      <circle
                        cx="70"
                        cy="70"
                        r="52"
                        fill="transparent"
                        stroke="#E66B67"
                        strokeWidth="15"
                        strokeDasharray={`${(pendPct / 100) * circumference} ${circumference}`}
                        strokeDashoffset={pendOffset}
                        strokeLinecap="round"
                        transform="rotate(-90 70 70)"
                      />

                      {/* Cancelled Segment (Slate Gray) */}
                      <circle
                        cx="70"
                        cy="70"
                        r="52"
                        fill="transparent"
                        stroke="#94A3B8"
                        strokeWidth="15"
                        strokeDasharray={`${(cancPct / 100) * circumference} ${circumference}`}
                        strokeDashoffset={cancOffset}
                        strokeLinecap="round"
                        transform="rotate(-90 70 70)"
                      />
                    </svg>

                    {/* Donut Center Count */}
                    <div className="donut-center-info">
                      <span className="donut-big-num">{donutTotal}</span>
                      <span className="donut-sub-label">Total Orders</span>
                    </div>
                  </div>

                  {/* Donut Legend */}
                  <div className="donut-legend-list">
                    <div className="legend-row">
                      <div className="legend-left">
                        <span className="legend-dot green"></span>
                        <span className="legend-name">Completed</span>
                      </div>
                      <div className="legend-right">
                        <b>{cCnt}</b>
                        <span className="legend-pct">{cPct}%</span>
                      </div>
                    </div>

                    <div className="legend-row">
                      <div className="legend-left">
                        <span className="legend-dot amber"></span>
                        <span className="legend-name">Preparing</span>
                      </div>
                      <div className="legend-right">
                        <b>{prepCnt}</b>
                        <span className="legend-pct">{prepPct}%</span>
                      </div>
                    </div>

                    <div className="legend-row">
                      <div className="legend-left">
                        <span className="legend-dot coral"></span>
                        <span className="legend-name">Pending</span>
                      </div>
                      <div className="legend-right">
                        <b>{pendCnt}</b>
                        <span className="legend-pct">{pendPct}%</span>
                      </div>
                    </div>

                    <div className="legend-row">
                      <div className="legend-left">
                        <span className="legend-dot gray"></span>
                        <span className="legend-name">Cancelled</span>
                      </div>
                      <div className="legend-right">
                        <b>{cancCnt}</b>
                        <span className="legend-pct">{cancPct}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fulfillment Velocity & Channel Operations */}
                <div className="donut-fulfillment-section">
                  <div className="donut-section-divider"></div>

                  {/* Channel Breakdown */}
                  <div className="donut-channels-block">
                    <div className="donut-channels-header">
                      <span className="donut-block-title">Channel Breakdown</span>
                      <span className="donut-block-total">{fulfillmentMetrics.total} tracked orders</span>
                    </div>

                    {/* Segmented Channel Progress Bar */}
                    <div className="channel-multi-progress">
                      <div className="channel-seg dine-in" style={{ width: `${fulfillmentMetrics.dineInPct}%` }} title={`Dine-in: ${fulfillmentMetrics.dineIn} orders (${fulfillmentMetrics.dineInPct}%)`}></div>
                      <div className="channel-seg qr" style={{ width: `${fulfillmentMetrics.qrPct}%` }} title={`QR Self-Order: ${fulfillmentMetrics.qrCount} orders (${fulfillmentMetrics.qrPct}%)`}></div>
                      <div className="channel-seg online" style={{ width: `${fulfillmentMetrics.onlinePct}%` }} title={`Takeaway: ${fulfillmentMetrics.onlineCount} orders (${fulfillmentMetrics.onlinePct}%)`}></div>
                    </div>

                    {/* Channel Legend Row */}
                    <div className="channel-pills-row">
                      <div className="channel-pill">
                        <span className="channel-dot blue"></span>
                        <span className="channel-name">Dine-in: <b>{fulfillmentMetrics.dineIn}</b> <small>({fulfillmentMetrics.dineInPct}%)</small></span>
                      </div>
                      <div className="channel-pill">
                        <span className="channel-dot emerald"></span>
                        <span className="channel-name">QR Direct: <b>{fulfillmentMetrics.qrCount}</b> <small>({fulfillmentMetrics.qrPct}%)</small></span>
                      </div>
                      <div className="channel-pill">
                        <span className="channel-dot purple"></span>
                        <span className="channel-name">Takeaway: <b>{fulfillmentMetrics.onlineCount}</b> <small>({fulfillmentMetrics.onlinePct}%)</small></span>
                      </div>
                    </div>
                  </div>

                  {/* Kitchen SLA & Accuracy Metrics */}
                  <div className="donut-kitchen-matrix">
                    <div className="donut-sla-item">
                      <div className="donut-sla-ico">
                        <Clock size={14} />
                      </div>
                      <div className="donut-sla-data">
                        <span className="donut-sla-label">Avg. Prep Speed</span>
                        <strong className="donut-sla-val">{fulfillmentMetrics.avgPrepTime} <small>Target &lt;15m</small></strong>
                      </div>
                    </div>

                    <div className="donut-sla-item">
                      <div className="donut-sla-ico green">
                        <CheckCircle2 size={14} />
                      </div>
                      <div className="donut-sla-data">
                        <span className="donut-sla-label">Kitchen Accuracy</span>
                        <strong className="donut-sla-val">{fulfillmentMetrics.onTimeRate} <small>SLA met</small></strong>
                      </div>
                    </div>
                  </div>

                  {/* Live Queue Strip with direct KDS launcher */}
                  <div className="donut-quick-action-strip">
                    <div className="donut-queue-badge">
                      <span className="live-pulse-dot amber"></span>
                      <span><b>{fulfillmentMetrics.activeInKitchen}</b> orders in live queue</span>
                    </div>
                    <button
                      type="button"
                      className="donut-kds-link-btn"
                      onClick={() => {
                        setTab('orders');
                        setOrderViewMode('kds');
                      }}
                      title="Launch Kitchen Display System"
                    >
                      <ChefHat size={13} />
                      <span>Live KDS</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 3: RECENT ORDERS TABLE */}
            <div className="recent-orders-card">
              <div className="table-card-header">
                <div>
                  <h3 className="table-card-title">Recent Orders</h3>
                  <p className="table-card-sub">Latest orders from all channels</p>
                </div>
                <button className="view-all-link-btn" onClick={() => setTab('orders')}>
                  <span>View all</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="table-responsive-wrapper">
                <table className="orders-clean-table">
                  <thead>
                    <tr>
                      <th>ORDER ID</th>
                      <th>CUSTOMER</th>
                      <th>TOTAL</th>
                      <th>PAYMENT</th>
                      <th>STATUS</th>
                      <th>CHANNEL</th>
                      <th>TIME</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.slice(0, 5).map(o => {
                      const firstChar = (o.customerName || 'A')[0].toUpperCase();
                      const avatarColors = getAvatarColor(firstChar);

                      // Determine channel icon & label
                      const isQr = o.table?.toLowerCase().includes('qr') || o.table === '1' || o.table === '2';
                      const isOnline = o.table?.toLowerCase().includes('online');
                      const channelLabel = isOnline ? 'Online' : isQr ? 'QR Order' : 'Walk-in';

                      return (
                        <tr key={o._id}>
                          {/* ORDER ID */}
                          <td className="cell-order-id">
                            <b>{o.orderNo}</b>
                          </td>

                          {/* CUSTOMER */}
                          <td className="cell-customer">
                            <div className="customer-avatar-box" style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}>
                              {firstChar}
                            </div>
                            <div className="customer-meta">
                              <span className="customer-name">{o.customerName}</span>
                              <span className="customer-phone">{o.phone}</span>
                            </div>
                          </td>

                          {/* TOTAL */}
                          <td className="cell-total">
                            <b>{money(o.total)}</b>
                          </td>

                          {/* PAYMENT */}
                          <td className="cell-badge">
                            <span className={`status-pill payment ${o.paymentStatus}`}>
                              {o.paymentStatus === 'paid' ? 'PAID' : 'COD'}
                            </span>
                          </td>

                          {/* STATUS */}
                          <td className="cell-badge">
                            <span className={`status-pill order-state ${o.status}`}>
                              {o.status.toUpperCase()}
                            </span>
                          </td>

                          {/* CHANNEL */}
                          <td className="cell-channel">
                            <div className="channel-box">
                              {channelLabel === 'QR Order' ? (
                                <QrCode size={15} />
                              ) : channelLabel === 'Online' ? (
                                <Smartphone size={15} />
                              ) : (
                                <Utensils size={15} />
                              )}
                              <span>{channelLabel}</span>
                            </div>
                          </td>

                          {/* TIME */}
                          <td className="cell-time">
                            <span>{getTimeAgo(o.createdAt)}</span>
                          </td>

                          {/* ACTIONS */}
                          <td className="cell-actions">
                            <div className="actions-cluster">
                              <button
                                className="action-view-btn"
                                onClick={() => setSelectedOrder(o)}
                              >
                                View
                              </button>

                              <div className="action-menu-anchor">
                                <button
                                  className="action-dots-btn"
                                  onClick={() => setOrderMenuOpen(orderMenuOpen === o._id ? null : o._id)}
                                >
                                  <MoreVertical size={16} />
                                </button>

                                {orderMenuOpen === o._id && (
                                  <div className="action-popover-menu">
                                    <button onClick={() => patchOrder(o._id, { status: 'preparing' })}>
                                      Mark as Preparing
                                    </button>
                                    <button onClick={() => patchOrder(o._id, { status: 'ready' })}>
                                      Mark as Ready
                                    </button>
                                    <button onClick={() => patchOrder(o._id, { status: 'completed', paymentStatus: 'paid' })}>
                                      Mark as Completed
                                    </button>
                                    <button className="danger" onClick={() => patchOrder(o._id, { status: 'cancelled' })}>
                                      Cancel Order
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: ORDERS (CRM ENTERPRISE ORDERS & KDS) ===================== */}
        {tab === 'orders' && (
          <div className="tab-pane-container" style={{ padding: '0 0 40px 0' }}>
            <div className="crm-orders-wrapper">
              {/* 1. Operational Orders Header Card */}
              <div className="crm-orders-header-card">
                <div className="crm-orders-header-left">
                  <div className="crm-orders-brand-emblem">
                    <UtensilsCrossed size={24} style={{ color: '#DCEFE4' }} />
                  </div>
                  <div className="crm-orders-brand-info">
                    <div className="crm-orders-title-row">
                      <h1 className="crm-orders-title">Order Management & POS Queue</h1>
                      <span className="crm-menu-status-badge">
                        <span className="crm-pulse-dot" />
                        Live Orders Sync
                      </span>
                    </div>
                    <p className="crm-orders-subtitle">
                      Live dining tickets, kitchen cooking flow, and order fulfillment across tables
                    </p>
                  </div>
                </div>

                <div className="crm-orders-header-actions">
                  <button
                    type="button"
                    className="crm-btn-primary"
                    onClick={() => {
                      setManualOrderModalOpen(true);
                      setManualOrderDiner(null);
                      setManualOrderName('');
                      setManualOrderPhone('');
                      setManualOrderTable('Counter / Takeaway');
                      setManualOrderPaymentMethod('cash');
                      setManualOrderPaymentStatus('paid');
                      setManualOrderStatus('placed');
                      setManualOrderNotes('');
                      setManualOrderItems([]);
                      setManualOrderRewardId('');
                    }}
                  >
                    <Plus size={16} />
                    <span>New Walk-in Order</span>
                  </button>

                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => window.open(data?.cafe?.slug ? `/kds/${data.cafe.slug}` : '/kds', '_blank')}
                    title="Launch Fullscreen Kitchen Display System in dedicated screen"
                  >
                    <ChefHat size={15} />
                    <span>Fullscreen KDS</span>
                    <ExternalLink size={12} />
                  </button>

                  <button
                    type="button"
                    className="crm-icon-circle-btn"
                    onClick={load}
                    title="Refresh live orders"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>

              {/* 2. Top Operational Metrics Strip (Espresso & Cognac theme) */}
              <div className="crm-orders-metrics-grid">
                <div className="crm-orders-stat-card">
                  <div className="crm-stat-icon-wrap cognac">
                    <Clock size={20} />
                  </div>
                  <div className="crm-stat-content">
                    <span className="crm-stat-label">Active Orders</span>
                    <h3 className="crm-stat-value">
                      {(data?.orders || []).filter(o => ['placed', 'accepted', 'preparing', 'ready'].includes(o.status)).length}
                    </h3>
                  </div>
                  <span className="crm-stat-tag warm">In Progress</span>
                </div>

                <div className="crm-orders-stat-card">
                  <div className="crm-stat-icon-wrap orange">
                    <Flame size={20} />
                  </div>
                  <div className="crm-stat-content">
                    <span className="crm-stat-label">In Kitchen (Cooking)</span>
                    <h3 className="crm-stat-value">
                      {(data?.orders || []).filter(o => o.status === 'preparing').length}
                    </h3>
                  </div>
                  <span className="crm-stat-tag cooking">On Stove</span>
                </div>

                <div className="crm-orders-stat-card">
                  <div className="crm-stat-icon-wrap green">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="crm-stat-content">
                    <span className="crm-stat-label">Ready for Service</span>
                    <h3 className="crm-stat-value">
                      {(data?.orders || []).filter(o => o.status === 'ready').length}
                    </h3>
                  </div>
                  <span className="crm-stat-tag ready">Pass Ready</span>
                </div>

                <div className="crm-orders-stat-card">
                  <div className="crm-stat-icon-wrap espresso">
                    <Coins size={20} />
                  </div>
                  <div className="crm-stat-content">
                    <span className="crm-stat-label">Total Volume (Gross)</span>
                    <h3 className="crm-stat-value">
                      {money((data?.orders || []).filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0))}
                    </h3>
                  </div>
                  <span className="crm-stat-tag neutral">{(data?.orders || []).length} Total</span>
                </div>
              </div>

              {/* 3. Toolbar & View Controls */}
              <div className="crm-orders-toolbar-card">
                <div className="crm-orders-toolbar-left">
                  {/* View Mode Toggle: Table View vs KDS */}
                  <div className="crm-view-mode-toggle">
                    <button
                      type="button"
                      className={`crm-view-btn ${orderViewMode === 'table' ? 'active' : ''}`}
                      onClick={() => setOrderViewMode('table')}
                    >
                      <PackageOpen size={15} />
                      <span>Table View</span>
                    </button>
                    <button
                      type="button"
                      className={`crm-view-btn ${orderViewMode === 'kds' ? 'active' : ''}`}
                      onClick={() => setOrderViewMode('kds')}
                    >
                      <ChefHat size={15} />
                      <span>Kitchen Board (KDS)</span>
                    </button>
                  </div>

                  {/* Status Filter Chips */}
                  <div className="crm-orders-filter-chips">
                    {[
                      { key: 'all', label: 'All Orders', count: (data?.orders || []).length },
                      {
                        key: 'active',
                        label: 'Active',
                        count: (data?.orders || []).filter(o => ['placed', 'accepted', 'preparing', 'ready'].includes(o.status)).length
                      },
                      {
                        key: 'incoming',
                        label: 'Incoming',
                        count: (data?.orders || []).filter(o => o.status === 'placed' || o.status === 'accepted').length
                      },
                      {
                        key: 'preparing',
                        label: 'Cooking',
                        count: (data?.orders || []).filter(o => o.status === 'preparing').length
                      },
                      {
                        key: 'ready',
                        label: 'Ready',
                        count: (data?.orders || []).filter(o => o.status === 'ready').length
                      },
                      {
                        key: 'completed',
                        label: 'Fulfilled',
                        count: (data?.orders || []).filter(o => o.status === 'completed').length
                      },
                      {
                        key: 'cancelled',
                        label: 'Cancelled',
                        count: (data?.orders || []).filter(o => o.status === 'cancelled').length
                      }
                    ].map(f => (
                      <button
                        key={f.key}
                        type="button"
                        className={`crm-filter-chip ${ordersStatusTab === f.key ? 'active' : ''}`}
                        onClick={() => setOrdersStatusTab(f.key)}
                      >
                        <span>{f.label}</span>
                        <span className="crm-chip-badge">{f.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="crm-orders-toolbar-right">
                  <div className="crm-orders-search-box">
                    <Search size={15} className="crm-search-icon" />
                    <input
                      type="text"
                      placeholder="Search Order #, Customer, Table..."
                      value={ordersSearchQuery}
                      onChange={e => setOrdersSearchQuery(e.target.value)}
                      className="crm-orders-search-input"
                    />
                    {ordersSearchQuery && (
                      <button
                        type="button"
                        className="crm-search-clear-btn"
                        onClick={() => setOrdersSearchQuery('')}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* VIEW 1: KITCHEN DISPLAY SYSTEM (KDS) BOARD */}
              {orderViewMode === 'kds' && (
                <div className="crm-kds-board-grid">
                  {/* Column 1: Incoming & Placed */}
                  <div className="crm-kds-column">
                    <div className="crm-kds-column-header incoming">
                      <div className="crm-kds-header-title">
                        <span className="crm-kds-dot pulse" />
                        <span>1. Incoming & Placed</span>
                      </div>
                      <span className="crm-kds-col-count">
                        {(data?.orders || []).filter(o => o.status === 'placed' || o.status === 'accepted').length}
                      </span>
                    </div>

                    <div className="crm-kds-orders-stack">
                      {(data?.orders || [])
                        .filter(o => o.status === 'placed' || o.status === 'accepted')
                        .filter(o => {
                          if (!ordersSearchQuery.trim()) return true;
                          const q = ordersSearchQuery.toLowerCase().trim();
                          return (
                            (o.orderNo || '').toLowerCase().includes(q) ||
                            (o.customerName || '').toLowerCase().includes(q) ||
                            String(o.table || '').toLowerCase().includes(q)
                          );
                        })
                        .map(o => (
                          <div className="crm-kds-ticket-card" key={o._id}>
                            <div className="crm-kds-ticket-top" onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                              <div>
                                <div className="crm-kds-ticket-num">{o.orderNo}</div>
                                <span className="crm-kds-ticket-time">
                                  <Clock size={11} /> {getTimeAgo(o.createdAt)}
                                </span>
                              </div>
                              <span className="crm-kds-table-pill">
                                Table {o.table}
                              </span>
                            </div>

                            <div className="crm-kds-customer-row">
                              <span className="crm-kds-customer-name">{o.customerName || 'Walk-in Guest'}</span>
                              <span className="crm-kds-pay-badge">{o.paymentStatus?.toUpperCase() || 'UNPAID'}</span>
                            </div>

                            <div className="crm-kds-items-list" onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                              {(o.items || []).map((it, idx) => (
                                <div className="crm-kds-item-row" key={idx}>
                                  <span className="crm-kds-item-qty">{it.quantity}×</span>
                                  <span className="crm-kds-item-name">{it.name}</span>
                                </div>
                              ))}
                              {(!o.items || o.items.length === 0) && (
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Items details unavailable</span>
                              )}
                            </div>

                            <div className="crm-kds-ticket-footer">
                              <button
                                type="button"
                                className="crm-kds-action-btn cook"
                                onClick={() => patchOrder(o._id, { status: 'preparing' })}
                              >
                                <ChefHat size={15} />
                                <span>Accept & Start Cooking</span>
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>
                        ))}

                      {(data?.orders || []).filter(o => o.status === 'placed' || o.status === 'accepted').length === 0 && (
                        <div className="crm-kds-empty-state">
                          <PackageOpen size={30} style={{ opacity: 0.35, marginBottom: 8 }} />
                          <p>No new incoming tickets.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column 2: In Preparation (Cooking) */}
                  <div className="crm-kds-column">
                    <div className="crm-kds-column-header cooking">
                      <div className="crm-kds-header-title">
                        <span className="crm-kds-dot orange" />
                        <span>2. In Kitchen (Cooking)</span>
                      </div>
                      <span className="crm-kds-col-count">
                        {(data?.orders || []).filter(o => o.status === 'preparing').length}
                      </span>
                    </div>

                    <div className="crm-kds-orders-stack">
                      {(data?.orders || [])
                        .filter(o => o.status === 'preparing')
                        .filter(o => {
                          if (!ordersSearchQuery.trim()) return true;
                          const q = ordersSearchQuery.toLowerCase().trim();
                          return (
                            (o.orderNo || '').toLowerCase().includes(q) ||
                            (o.customerName || '').toLowerCase().includes(q) ||
                            String(o.table || '').toLowerCase().includes(q)
                          );
                        })
                        .map(o => (
                          <div className="crm-kds-ticket-card in-kitchen" key={o._id}>
                            <div className="crm-kds-ticket-top" onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                              <div>
                                <div className="crm-kds-ticket-num">{o.orderNo}</div>
                                <span className="crm-kds-ticket-time warning">
                                  <Clock size={11} /> Cooking for {getTimeAgo(o.createdAt)}
                                </span>
                              </div>
                              <span className="crm-kds-table-pill">
                                Table {o.table}
                              </span>
                            </div>

                            <div className="crm-kds-customer-row">
                              <span className="crm-kds-customer-name">{o.customerName || 'Guest'}</span>
                              <span className="crm-kds-pay-badge">{o.paymentStatus?.toUpperCase() || 'UNPAID'}</span>
                            </div>

                            <div className="crm-kds-items-list" onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                              {(o.items || []).map((it, idx) => (
                                <div className="crm-kds-item-row" key={idx}>
                                  <span className="crm-kds-item-qty">{it.quantity}×</span>
                                  <span className="crm-kds-item-name">{it.name}</span>
                                </div>
                              ))}
                            </div>

                            <div className="crm-kds-ticket-footer">
                              <button
                                type="button"
                                className="crm-kds-action-btn ready"
                                onClick={() => patchOrder(o._id, { status: 'ready' })}
                              >
                                <CheckCircle2 size={15} />
                                <span>Mark as Ready for Pickup</span>
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>
                        ))}

                      {(data?.orders || []).filter(o => o.status === 'preparing').length === 0 && (
                        <div className="crm-kds-empty-state">
                          <ChefHat size={30} style={{ opacity: 0.35, marginBottom: 8 }} />
                          <p>No tickets currently on stove.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column 3: Ready for Service (Pass) */}
                  <div className="crm-kds-column">
                    <div className="crm-kds-column-header ready">
                      <div className="crm-kds-header-title">
                        <span className="crm-kds-dot green" />
                        <span>3. Ready for Service</span>
                      </div>
                      <span className="crm-kds-col-count">
                        {(data?.orders || []).filter(o => o.status === 'ready').length}
                      </span>
                    </div>

                    <div className="crm-kds-orders-stack">
                      {(data?.orders || [])
                        .filter(o => o.status === 'ready')
                        .filter(o => {
                          if (!ordersSearchQuery.trim()) return true;
                          const q = ordersSearchQuery.toLowerCase().trim();
                          return (
                            (o.orderNo || '').toLowerCase().includes(q) ||
                            (o.customerName || '').toLowerCase().includes(q) ||
                            String(o.table || '').toLowerCase().includes(q)
                          );
                        })
                        .map(o => (
                          <div className="crm-kds-ticket-card ready-to-serve" key={o._id}>
                            <div className="crm-kds-ticket-top" onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                              <div>
                                <div className="crm-kds-ticket-num">{o.orderNo}</div>
                                <span className="crm-kds-ticket-time success">
                                  <CheckCircle2 size={11} /> Ready to serve
                                </span>
                              </div>
                              <span className="crm-kds-table-pill ready">
                                Table {o.table}
                              </span>
                            </div>

                            <div className="crm-kds-customer-row">
                              <span className="crm-kds-customer-name">{o.customerName || 'Guest'}</span>
                              <span className="crm-kds-pay-badge">{o.paymentStatus?.toUpperCase() || 'UNPAID'}</span>
                            </div>

                            <div className="crm-kds-items-list" onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                              {(o.items || []).map((it, idx) => (
                                <div className="crm-kds-item-row" key={idx}>
                                  <span className="crm-kds-item-qty">{it.quantity}×</span>
                                  <span className="crm-kds-item-name">{it.name}</span>
                                </div>
                              ))}
                            </div>

                            <div className="crm-kds-ticket-footer">
                              <button
                                type="button"
                                className="crm-kds-action-btn complete"
                                onClick={() => patchOrder(o._id, { status: 'completed', paymentStatus: 'paid' })}
                              >
                                <Check size={15} />
                                <span>Served & Fulfilled</span>
                                <CheckCircle2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}

                      {(data?.orders || []).filter(o => o.status === 'ready').length === 0 && (
                        <div className="crm-kds-empty-state">
                          <CheckCircle2 size={30} style={{ opacity: 0.35, marginBottom: 8 }} />
                          <p>No orders waiting on the pass.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: STANDARD TABLE QUEUE VIEW */}
              {orderViewMode === 'table' && (
                <div className="crm-table-container">
                  <div className="crm-table-responsive-wrapper">
                    <table className="crm-orders-table">
                      <thead>
                        <tr>
                          <th>ORDER REF</th>
                          <th>CUSTOMER</th>
                          <th>LOCATION & ITEMS</th>
                          <th>BILL TOTAL</th>
                          <th>PAYMENT</th>
                          <th>STAGE</th>
                          <th style={{ textAlign: 'right' }}>QUICK ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordersTabFiltered.map(o => {
                          const avatar = getAvatarColor(o.customerName || 'G');
                          return (
                            <tr key={o._id} className="crm-orders-row">
                              <td className="cell-order-id" onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                                <div className="crm-order-ref-title">{o.orderNo}</div>
                                <span className="crm-order-ref-time">
                                  <Clock size={11} /> {getTimeAgo(o.createdAt)}
                                </span>
                              </td>

                              <td className="cell-customer" onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                                <div
                                  className="crm-customer-avatar-box"
                                  style={{ background: avatar.bg, color: avatar.text }}
                                >
                                  {(o.customerName || 'G').charAt(0).toUpperCase()}
                                </div>
                                <div className="crm-customer-meta">
                                  <span className="crm-customer-name">{o.customerName || 'Walk-in Guest'}</span>
                                  <span className="crm-customer-phone">{o.phone || 'No phone recorded'}</span>
                                </div>
                              </td>

                              <td onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                                <div className="crm-table-ref-badge">
                                  <Armchair size={12} />
                                  <span>{String(o.table).toLowerCase().includes('counter') ? 'Counter / Takeaway' : `Table ${o.table}`}</span>
                                </div>
                                <span className="crm-items-summary-sub">
                                  {o.items?.length || 1} line item{o.items?.length === 1 ? '' : 's'}
                                  {o.items?.[0] ? ` • ${o.items[0].name}` : ''}
                                  {o.items?.length > 1 ? ` +${o.items.length - 1} more` : ''}
                                </span>
                              </td>

                              <td className="cell-total" onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                                <div className="crm-order-total-amount">{money(o.total)}</div>
                                <span className="crm-order-payment-method">
                                  {(o.paymentMethod || 'cash').toUpperCase()}
                                </span>
                              </td>

                              <td>
                                <span className={`crm-status-pill payment ${o.paymentStatus}`}>
                                  {o.paymentStatus === 'paid' ? 'PAID' : (o.paymentStatus || 'PENDING').toUpperCase()}
                                </span>
                              </td>

                              <td>
                                <span className={`crm-status-pill order-state ${o.status}`}>
                                  {o.status.toUpperCase()}
                                </span>
                              </td>

                              <td style={{ textAlign: 'right' }}>
                                <div className="crm-table-action-cell">
                                  {o.status === 'placed' && (
                                    <button
                                      type="button"
                                      className="crm-quick-step-btn cook"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        patchOrder(o._id, { status: 'preparing' });
                                      }}
                                      title="Start cooking ticket"
                                    >
                                      Cook <ArrowRight size={12} />
                                    </button>
                                  )}
                                  {o.status === 'preparing' && (
                                    <button
                                      type="button"
                                      className="crm-quick-step-btn ready"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        patchOrder(o._id, { status: 'ready' });
                                      }}
                                      title="Mark order ready"
                                    >
                                      Ready <CheckCircle2 size={12} />
                                    </button>
                                  )}
                                  {o.status === 'ready' && (
                                    <button
                                      type="button"
                                      className="crm-quick-step-btn complete"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        patchOrder(o._id, { status: 'completed', paymentStatus: 'paid' });
                                      }}
                                      title="Mark order served & paid"
                                    >
                                      Serve <Check size={12} />
                                    </button>
                                  )}
                                  <select
                                    className="crm-table-select-status"
                                    value={o.status}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e =>
                                      patchOrder(o._id, {
                                        status: e.target.value,
                                        ...(e.target.value === 'completed' ? { paymentStatus: 'paid' } : {})
                                      })
                                    }
                                  >
                                    {['placed', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'].map(s => (
                                      <option key={s} value={s}>
                                        {s.toUpperCase()}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {ordersTabFiltered.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '60px 20px' }}>
                              <div className="crm-empty-table-state">
                                <PackageOpen size={36} style={{ color: '#176B50', opacity: 0.6, marginBottom: 12 }} />
                                <h4>No orders matching criteria</h4>
                                <p>Try clearing your search query or selecting a different status filter.</p>
                                {(ordersSearchQuery || ordersStatusTab !== 'all') && (
                                  <button
                                    type="button"
                                    className="crm-btn-secondary"
                                    style={{ marginTop: 12 }}
                                    onClick={() => {
                                      setOrdersSearchQuery('');
                                      setOrdersStatusTab('all');
                                    }}
                                  >
                                    Reset Filters
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: BOOKINGS (PHASE 10: ADVANCED TABLE RESERVATION & CAPACITY ENGINE) ===================== */}
        {tab === 'bookings' && (
          <div className="tab-pane-container bookings-engine-container" style={{ padding: '0 0 40px 0' }}>
            <div className="crm-orders-wrapper">
              {/* 1. Operational Bookings Header Card */}
              <div className="crm-orders-header-card">
                <div className="crm-orders-header-left">
                  <div className="crm-orders-brand-emblem">
                    <Armchair size={24} style={{ color: '#DCEFE4' }} />
                  </div>
                  <div className="crm-orders-brand-info">
                    <div className="crm-orders-title-row">
                      <h1 className="crm-orders-title">Table Reservations & Floor Plan</h1>
                      <span className="crm-menu-status-badge">
                        <span className="crm-pulse-dot" />
                        Floor Engine Active
                      </span>
                    </div>
                    <p className="crm-orders-subtitle">
                      Live table occupancy, instant walk-in seating, and advance reservation scheduling
                    </p>
                  </div>
                </div>

                <div className="crm-orders-header-actions">
                  <button
                    type="button"
                    className="crm-btn-primary"
                    onClick={() => {
                      const firstAvail = tablesList.find(t => t.status === 'available');
                      setWalkinModal({ table: firstAvail || tablesList[0] || null });
                      setWalkinPartySize(firstAvail?.capacity || 2);
                      setWalkinGuestName('');
                      setWalkinPhone('');
                      setWalkinNote('');
                      setTableConflictNotice(null);
                    }}
                  >
                    <Plus size={16} />
                    <span>Quick Walk-In (1-Tap)</span>
                  </button>

                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => {
                      setNewBookingModal(true);
                      setNewBookingName('');
                      setNewBookingPhone('');
                      setNewBookingGuests(2);
                      const now = new Date();
                      now.setMinutes(now.getMinutes() + 30);
                      setNewBookingDateTime(now.toISOString().slice(0, 16));
                      setNewBookingTableId('');
                      setNewBookingNote('');
                      setTableConflictNotice(null);
                    }}
                  >
                    <CalendarCheck size={16} />
                    <span>New Reservation</span>
                  </button>

                  {(isOwner || isManager) && (
                    <button
                      type="button"
                      className="crm-btn-secondary"
                      onClick={() => {
                        setTableConfigModal({ isNew: true });
                        setEditTableNumber(String(tablesList.length + 1));
                        setEditTableName(`Table ${tablesList.length + 1}`);
                        setEditTableCapacity(4);
                        setEditTableSection('Main Floor');
                      }}
                      title="Add a new table to floor layout"
                    >
                      <Armchair size={15} />
                      <span>Add Table</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="crm-icon-circle-btn"
                    onClick={() => {
                      fetchTables();
                      fetchBookings();
                    }}
                    title="Refresh floor state"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>

              {/* 2. Top Operational Metrics Ribbon */}
              <div className="crm-orders-metrics-grid">
                <div className="crm-orders-stat-card">
                  <div className="crm-stat-icon-wrap cognac">
                    <Armchair size={20} />
                  </div>
                  <div className="crm-stat-content">
                    <span className="crm-stat-label">Total Tables</span>
                    <h3 className="crm-stat-value">{tablesList.length || data?.tables?.length || 0}</h3>
                  </div>
                  <span className="crm-stat-tag neutral">4 Floor Zones</span>
                </div>

                <div className="crm-orders-stat-card">
                  <div className="crm-stat-icon-wrap green">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="crm-stat-content">
                    <span className="crm-stat-label">Available Tables</span>
                    <h3 className="crm-stat-value">
                      {tablesList.filter(t => t.status === 'available').length}
                    </h3>
                  </div>
                  <span className="crm-stat-tag ready">Ready for Seating</span>
                </div>

                <div className="crm-orders-stat-card">
                  <div className="crm-stat-icon-wrap orange">
                    <Timer size={20} />
                  </div>
                  <div className="crm-stat-content">
                    <span className="crm-stat-label">Occupied Tables</span>
                    <h3 className="crm-stat-value">
                      {tablesList.filter(t => t.status === 'occupied').length}
                    </h3>
                  </div>
                  <span className="crm-stat-tag warm">
                    {tablesList.length ? Math.round((tablesList.filter(t => t.status === 'occupied').length / tablesList.length) * 100) : 0}% Occupied
                  </span>
                </div>

                <div className="crm-orders-stat-card">
                  <div className="crm-stat-icon-wrap espresso">
                    <CalendarCheck size={20} />
                  </div>
                  <div className="crm-stat-content">
                    <span className="crm-stat-label">Today's Bookings</span>
                    <h3 className="crm-stat-value">{bookingStats.todayTotal}</h3>
                  </div>
                  <span className="crm-stat-tag neutral">
                    {bookingStats.todayConfirmed} Confirmed
                  </span>
                </div>
              </div>

              {/* 3. Controls Bar & View Switcher */}
              <div className="crm-orders-toolbar-card">
                <div className="crm-orders-toolbar-left">
                  <div className="crm-view-mode-toggle">
                    <button
                      type="button"
                      className={`crm-view-btn ${floorViewMode === 'floor' ? 'active' : ''}`}
                      onClick={() => setFloorViewMode('floor')}
                    >
                      <LayoutGrid size={15} />
                      <span>Floor Layout Grid</span>
                    </button>
                    <button
                      type="button"
                      className={`crm-view-btn ${floorViewMode === 'reservations' ? 'active' : ''}`}
                      onClick={() => setFloorViewMode('reservations')}
                    >
                      <CalendarDays size={15} />
                      <span>Reservations Schedule ({bookingsList.length})</span>
                    </button>
                  </div>

                  {floorViewMode === 'floor' ? (
                    <div className="crm-orders-filter-chips">
                      {['all', 'Main Floor', 'Window Section', 'Patio Garden', 'Mezzanine Booth'].map(sec => {
                        const count = sec === 'all'
                          ? tablesList.length
                          : tablesList.filter(t => (t.section || 'Main Floor') === sec).length;
                        return (
                          <button
                            key={sec}
                            type="button"
                            className={`crm-filter-chip ${tableSectionFilter === sec ? 'active' : ''}`}
                            onClick={() => setTableSectionFilter(sec)}
                          >
                            <span>{sec === 'all' ? 'All Sections' : sec}</span>
                            <span className="crm-chip-badge">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <div className="crm-orders-search-box" style={{ background: '#faf8f5', borderRadius: 12, border: '1px solid #ece4da', padding: '4px 8px' }}>
                        <Calendar size={14} style={{ color: '#7d736b', marginRight: 6 }} />
                        <input
                          type="date"
                          value={bookingDate}
                          onChange={e => setBookingDate(e.target.value)}
                          style={{ border: 'none', background: 'transparent', fontSize: '12.5px', color: '#1e1611', outline: 'none' }}
                        />
                        <button
                          type="button"
                          className="crm-quick-step-btn ready"
                          style={{ marginLeft: 6, padding: '3px 8px' }}
                          onClick={() => setBookingDate(new Date().toISOString().split('T')[0])}
                        >
                          Today
                        </button>
                      </div>

                      <select
                        className="crm-table-select-status"
                        value={bookingStatusFilter}
                        onChange={e => setBookingStatusFilter(e.target.value)}
                      >
                        <option value="all">All Statuses</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="seated">Seated (Dining)</option>
                        <option value="pending">Pending Approval</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled / No-Show</option>
                      </select>
                    </div>
                  )}
                </div>

                {floorViewMode === 'reservations' && (
                  <div className="crm-orders-toolbar-right">
                    <div className="crm-orders-search-box">
                      <Search size={15} className="crm-search-icon" />
                      <input
                        type="text"
                        placeholder="Search guest, phone, notes..."
                        value={bookingSearch}
                        onChange={e => setBookingSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && fetchBookings(bookingDate, bookingStatusFilter)}
                        className="crm-orders-search-input"
                      />
                      {bookingSearch && (
                        <button
                          type="button"
                          className="crm-search-clear-btn"
                          onClick={() => setBookingSearch('')}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* VIEW 1: FLOOR LAYOUT GRID */}
              {floorViewMode === 'floor' && (
                <div className="crm-floor-plan-view-wrap">
                  {['Main Floor', 'Window Section', 'Patio Garden', 'Mezzanine Booth']
                    .filter(sec => tableSectionFilter === 'all' || tableSectionFilter === sec)
                    .map(secName => {
                      const sectionTables = tablesList.filter(t => (t.section || 'Main Floor') === secName);
                      if (!sectionTables.length && tableSectionFilter !== 'all') return null;

                      return (
                        <div className="crm-floor-section-group" key={secName}>
                          <div className="crm-floor-section-header">
                            <div className="crm-floor-section-title">
                              <span className="crm-pulse-dot" />
                              <h4>{secName}</h4>
                              <span className="crm-section-table-count">{sectionTables.length} Tables</span>
                            </div>
                            <div className="crm-section-occupancy-pill">
                              {sectionTables.filter(t => t.status === 'occupied').length} / {sectionTables.length} Seated
                            </div>
                          </div>

                          <div className="crm-floor-tables-grid">
                            {sectionTables.map(t => {
                              const isOccupied = t.status === 'occupied';
                              const isReserved = t.status === 'reserved';
                              const isAvailable = t.status === 'available';
                              const activeBooking = t.currentBooking || bookingsList.find(b => 
                                (t.currentBookingId && (b.id === t.currentBookingId || b._id === t.currentBookingId)) ||
                                ((b.tableId === t.id || (t.tableNumber && String(b.tableNumber) === String(t.tableNumber))) && 
                                 (isOccupied ? b.status === 'seated' : (b.status === 'confirmed' || b.status === 'seated')))
                              );
                              const timer = isOccupied ? getDiningTimer(activeBooking?.seatedAt || t.updatedAt, 90) : null;

                              return (
                                <div
                                  key={t.id}
                                  className={`crm-cafe-table-card ${t.status}`}
                                >
                                  <div className="crm-table-card-top">
                                    <div className="crm-table-num-badge">
                                      <Armchair size={14} />
                                      <span>T-{t.tableNumber}</span>
                                    </div>
                                    <span className={`crm-status-pill ${t.status === 'occupied' ? 'order-state preparing' : t.status === 'reserved' ? 'order-state ready' : 'payment paid'}`}>
                                      {t.status === 'occupied' ? 'Occupied' : t.status === 'reserved' ? 'Reserved' : 'Available'}
                                    </span>
                                  </div>

                                  <div className="crm-table-card-body">
                                    <div className="crm-table-name-txt">{t.name || `Table ${t.tableNumber}`}</div>
                                    <div className="crm-table-capacity-txt">
                                      <Users size={12} />
                                      <span>Capacity: {t.capacity} Guests</span>
                                    </div>

                                    {/* Occupied State with Live Dining Timer */}
                                    {isOccupied && (
                                      <div className="crm-table-dining-progress-box">
                                        <div className="crm-dining-timer-row">
                                          <span className="crm-dining-timer-label">
                                            <Timer size={12} />
                                            {timer?.isOvertime ? 'Overtime Dining' : 'Active Seated'}
                                          </span>
                                          <span className={`crm-dining-timer-val ${timer?.isOvertime ? 'overtime' : ''}`}>
                                            {timer?.text}
                                          </span>
                                        </div>
                                        <div className="crm-dining-progress-track">
                                          <div
                                            className={`crm-dining-progress-fill ${timer?.isOvertime ? 'overtime' : ''}`}
                                            style={{ width: `${timer?.percent || 0}%` }}
                                          />
                                        </div>
                                        <div className="crm-table-guest-name">
                                          {activeBooking ? `${activeBooking.name} (${activeBooking.guests}p)` : 'Seated Party'}
                                        </div>
                                      </div>
                                    )}

                                    {/* Reserved State */}
                                    {isReserved && (
                                      <div className="crm-table-reserved-box">
                                        <CalendarCheck size={14} style={{ color: '#1e40af', flexShrink: 0 }} />
                                        <div className="crm-reserved-details">
                                          <div className="crm-reserved-guest">
                                            {activeBooking?.name ? `${activeBooking.name} (${activeBooking.guests || 2}p)` : 'Upcoming Reservation'}
                                          </div>
                                          <div className="crm-reserved-time">
                                            {activeBooking?.dateTime ? new Date(activeBooking.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Reserved'}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Available State */}
                                    {isAvailable && (
                                      <div className="crm-table-available-box">
                                        <span className="crm-avail-hint">Ready for immediate walk-in or booking</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="crm-table-card-actions">
                                    {isAvailable && (
                                      <button
                                        type="button"
                                        className="crm-table-action-btn primary"
                                        onClick={() => {
                                          setWalkinModal({ table: t });
                                          setWalkinPartySize(t.capacity);
                                          setWalkinGuestName('');
                                          setWalkinPhone('');
                                          setWalkinNote('');
                                          setTableConflictNotice(null);
                                        }}
                                      >
                                        Seat Walk-In
                                      </button>
                                    )}

                                    {isOccupied && (
                                      <button
                                        type="button"
                                        className="crm-table-action-btn complete"
                                        onClick={() => handleFreeTable(t.id)}
                                        title="Clear table and mark dining completed"
                                      >
                                        <Check size={14} /> Free Table
                                      </button>
                                    )}

                                    {isReserved && (
                                      <button
                                        type="button"
                                        className="crm-table-action-btn seat"
                                        onClick={() => handleSeatTableNow(t, activeBooking)}
                                      >
                                        Seat Guest Now
                                      </button>
                                    )}

                                    {(isOwner || isManager) && (
                                      <button
                                        type="button"
                                        className="crm-icon-circle-btn"
                                        style={{ width: 34, height: 34 }}
                                        onClick={() => {
                                          setTableConfigModal({ table: t });
                                          setEditTableNumber(t.tableNumber);
                                          setEditTableName(t.name);
                                          setEditTableCapacity(t.capacity);
                                          setEditTableSection(t.section || 'Main Floor');
                                        }}
                                        title="Edit Table Configuration"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* VIEW 2: RESERVATIONS SCHEDULE */}
              {floorViewMode === 'reservations' && (
                <div className="crm-table-container">
                  {!bookingsList.length ? (
                    <div className="crm-empty-table-state" style={{ padding: '60px 20px' }}>
                      <CalendarDays size={42} style={{ color: '#176B50', opacity: 0.6, marginBottom: 12 }} />
                      <h4>No Reservations Found</h4>
                      <p>There are no table reservations scheduled for {bookingDate}.</p>
                      <button
                        type="button"
                        className="crm-btn-primary"
                        onClick={() => {
                          setNewBookingModal(true);
                          setNewBookingGuests(2);
                          setNewBookingName('');
                          setNewBookingPhone('');
                          const now = new Date();
                          now.setMinutes(now.getMinutes() + 30);
                          setNewBookingDateTime(now.toISOString().slice(0, 16));
                          setTableConflictNotice(null);
                        }}
                        style={{ marginTop: 14 }}
                      >
                        <Plus size={16} /> Create Reservation
                      </button>
                    </div>
                  ) : (
                    <div className="crm-table-responsive-wrapper">
                      <table className="crm-orders-table">
                        <thead>
                          <tr>
                            <th>TIME & DATE</th>
                            <th>GUEST DETAILS</th>
                            <th>PARTY</th>
                            <th>ASSIGNED TABLE</th>
                            <th>SOURCE</th>
                            <th>STATUS</th>
                            <th style={{ textAlign: 'right' }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookingsList.map(b => {
                            const diningTimer = b.status === 'seated' ? getDiningTimer(b.seatedAt || b.dateTime, b.durationMinutes || 90) : null;
                            const waUrl = getWhatsAppBookingUrl(b);
                            const avatar = getAvatarColor(b.name || 'G');

                            return (
                              <tr key={b.id || b._id} className="crm-orders-row">
                                <td className="time-col">
                                  <div className="crm-order-ref-title">
                                    {new Date(b.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                  <span className="crm-order-ref-time">
                                    {new Date(b.dateTime).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                  </span>
                                </td>

                                <td className="cell-customer">
                                  <div
                                    className="crm-customer-avatar-box"
                                    style={{ background: avatar.bg, color: avatar.text }}
                                  >
                                    {(b.name || 'G').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="crm-customer-meta">
                                    <span className="crm-customer-name">{b.name}</span>
                                    <span className="crm-customer-phone">{b.phone || 'No phone'}</span>
                                    {b.note && <small style={{ color: '#8c8279', fontStyle: 'italic', marginTop: 2 }}>"{b.note}"</small>}
                                  </div>
                                </td>

                                <td>
                                  <div className="crm-table-ref-badge" style={{ background: '#f3eeea', color: '#1e1611' }}>
                                    <Users size={12} />
                                    <span>{b.guests} Guests</span>
                                  </div>
                                </td>

                                <td>
                                  {b.tableNumber ? (
                                    <div className="crm-table-ref-badge">
                                      <Armchair size={12} />
                                      <span>T-{b.tableNumber}</span>
                                      {b.table?.section && <small>({b.table.section})</small>}
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="crm-quick-step-btn ready"
                                      onClick={() => {
                                        setReassignModal({ booking: b });
                                        setReassignSelectedTableId('');
                                        setTableConflictNotice(null);
                                      }}
                                    >
                                      + Assign Table
                                    </button>
                                  )}
                                </td>

                                <td>
                                  <span className="crm-chip-badge" style={{ textTransform: 'uppercase', padding: '3px 8px' }}>
                                    {b.source || 'online'}
                                  </span>
                                </td>

                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span className={`crm-status-pill ${b.status === 'confirmed' ? 'payment paid' : b.status === 'seated' ? 'order-state ready' : b.status === 'pending' ? 'order-state placed' : 'payment failed'}`}>
                                      {b.status.toUpperCase()}
                                    </span>
                                    {b.status === 'seated' && diningTimer && (
                                      <span style={{ fontSize: '11px', color: diningTimer.isOvertime ? '#E66B67' : '#16A579', fontWeight: 600 }}>
                                        <Timer size={10} style={{ display: 'inline', marginRight: 3 }} />
                                        {diningTimer.text}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td style={{ textAlign: 'right' }}>
                                  <div className="crm-table-action-cell">
                                    {/* WhatsApp Confirmation Trigger */}
                                    <a
                                      href={waUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="crm-quick-step-btn"
                                      style={{ background: '#dcfce7', color: '#15803d', textDecoration: 'none' }}
                                      title="Open WhatsApp Confirmation Chat"
                                    >
                                      <Send size={12} /> WA
                                    </a>

                                    {b.status === 'pending' && (
                                      <>
                                        <button
                                          type="button"
                                          className="crm-quick-step-btn complete"
                                          onClick={() => handleBookingStatusChange(b.id || b._id, 'confirmed')}
                                          title="Confirm Reservation"
                                        >
                                          <Check size={12} /> Confirm
                                        </button>
                                        <button
                                          type="button"
                                          className="crm-icon-circle-btn"
                                          style={{ width: 28, height: 28 }}
                                          onClick={() => handleBookingStatusChange(b.id || b._id, 'cancelled')}
                                          title="Decline Reservation"
                                        >
                                          <X size={12} />
                                        </button>
                                      </>
                                    )}

                                    {b.status === 'confirmed' && (
                                      <>
                                        <button
                                          type="button"
                                          className="crm-quick-step-btn cook"
                                          onClick={() => handleBookingStatusChange(b.id || b._id, 'seated')}
                                          title="Seat guest now (starts dining timer)"
                                        >
                                          Seat Now
                                        </button>
                                        <button
                                          type="button"
                                          className="crm-icon-circle-btn"
                                          style={{ width: 28, height: 28 }}
                                          onClick={() => {
                                            setReassignModal({ booking: b });
                                            setReassignSelectedTableId(b.tableId || '');
                                            setTableConflictNotice(null);
                                          }}
                                          title="Reassign Table"
                                        >
                                          <Armchair size={12} />
                                        </button>
                                      </>
                                    )}

                                    {b.status === 'seated' && (
                                      <button
                                        type="button"
                                        className="crm-quick-step-btn complete"
                                        onClick={() => handleBookingStatusChange(b.id || b._id, 'completed')}
                                        title="Complete dining and free table"
                                      >
                                        <CheckCircle2 size={12} /> Complete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: MENU (CRM ENTERPRISE MENU CATALOGUE) ===================== */}
        {tab === 'menu' && (
          <div className="tab-pane-container" style={{ padding: '0 0 40px 0' }}>
            <div className="crm-menu-wrapper">
              {/* 1. Venue Profile Header Bar */}
              <div className="crm-menu-header-card">
                <div className="crm-menu-header-left">
                  <div className="crm-menu-brand-emblem">
                    {data?.cafe?.logo ? (
                      <img src={data.cafe.logo} alt={data?.cafe?.name} />
                    ) : (
                      <Coffee size={24} style={{ color: '#176B50' }} />
                    )}
                  </div>
                  <div className="crm-menu-brand-info">
                    <div className="crm-menu-brand-title-row">
                      <h1 className="crm-menu-brand-title">{data?.cafe?.name || 'The Daily Grind'}</h1>
                      <span className="crm-menu-status-badge">
                        <span className="crm-pulse-dot" />
                        Live Menu
                      </span>
                    </div>
                    <p className="crm-menu-brand-subtitle">
                      {data?.cafe?.tagline || 'Artisan Roastery & Dining'} • <b>{data?.cafe?.menu?.length || 0}</b> published items • <b>{ownerCategories.length - 1}</b> categories
                    </p>
                  </div>

                  <div className="crm-menu-quick-links">
                    <button
                      type="button"
                      className="crm-icon-circle-btn"
                      onClick={() => {
                        const url = `${window.location.origin}/c/${data?.cafe?.slug || ''}`;
                        navigator.clipboard.writeText(url);
                        setError('Customer menu URL copied to clipboard!');
                      }}
                      title="Copy Public Customer Menu Link"
                    >
                      <Link2 size={15} />
                    </button>
                    <a
                      href={data?.cafe?.instagramUrl || 'https://instagram.com/gusstora.cafe'}
                      target="_blank"
                      rel="noreferrer"
                      className="crm-icon-circle-btn"
                      title="Instagram Profile"
                    >
                      <InstagramIcon size={15} />
                    </a>
                    <button
                      type="button"
                      className="crm-icon-circle-btn"
                      onClick={() => setOwnerQrModalOpen(true)}
                      title="View & Download Table QR Code"
                    >
                      <QrCode size={15} />
                    </button>
                  </div>
                </div>

                <div className="crm-menu-header-actions">
                  <button
                    type="button"
                    className="crm-btn-primary"
                    onClick={() => {
                      cancelEdit();
                      setOwnerAddModalOpen(true);
                    }}
                    title="Add a new dish or beverage"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                    <span>Add Menu Item</span>
                  </button>

                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => window.open(data?.cafe?.slug ? `/c/${data.cafe.slug}` : '/c/demo-cafe', '_blank')}
                    title="Open live customer view in new tab"
                  >
                    <ExternalLink size={15} />
                    <span>Customer View</span>
                  </button>

                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => setTab('settings')}
                    title="Café settings & branding"
                  >
                    <Settings size={15} />
                    <span>Settings</span>
                  </button>
                </div>
              </div>

              {/* 2. Dynamic Categories & Dietary Filter Strip */}
              <div className="crm-menu-toolbar">
                <div className="crm-cat-pills-scroll">
                  {ownerCategories.map(cat => {
                    const count = getCategoryCount(cat);
                    const isActive = ownerActiveCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`crm-cat-pill ${isActive ? 'active' : ''}`}
                        onClick={() => setOwnerActiveCategory(cat)}
                      >
                        <span>{cat}</span>
                        <span className="crm-cat-count">{count}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="crm-diet-chips-wrap">
                  <button
                    type="button"
                    className={`crm-diet-chip ${ownerDietFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setOwnerDietFilter('all')}
                  >
                    All Diet
                  </button>
                  <button
                    type="button"
                    className={`crm-diet-chip veg ${ownerDietFilter === 'veg' ? 'active' : ''}`}
                    onClick={() => setOwnerDietFilter(ownerDietFilter === 'veg' ? 'all' : 'veg')}
                  >
                    <span className="crm-diet-dot veg" />
                    Veg Only
                  </button>
                  <button
                    type="button"
                    className={`crm-diet-chip non-veg ${ownerDietFilter === 'non-veg' ? 'active' : ''}`}
                    onClick={() => setOwnerDietFilter(ownerDietFilter === 'non-veg' ? 'all' : 'non-veg')}
                  >
                    <span className="crm-diet-dot non-veg" />
                    Non-Veg
                  </button>
                  <button
                    type="button"
                    className={`crm-diet-chip live ${ownerDietFilter === 'live' ? 'active' : ''}`}
                    onClick={() => setOwnerDietFilter(ownerDietFilter === 'live' ? 'all' : 'live')}
                  >
                    <span className="crm-diet-dot live" />
                    Live Items
                  </button>
                </div>
              </div>

              {/* 3. Subbar: Section Title & Live Search / Sort Controls */}
              <div className="crm-menu-subbar">
                <div className="crm-menu-subbar-title-wrap">
                  <h2 className="crm-menu-section-title">
                    {ownerActiveCategory === 'All' ? 'All Dishes & Beverages' : ownerActiveCategory}
                  </h2>
                  <span className="crm-menu-section-badge">
                    {filteredOwnerMenu.length} {filteredOwnerMenu.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                <div className="crm-menu-subbar-controls">
                  {/* Live search input */}
                  <div className="crm-search-wrap">
                    <Search size={15} className="crm-search-icon" />
                    <input
                      type="text"
                      placeholder="Search items, ingredients…"
                      value={ownerSearchQuery}
                      onChange={e => setOwnerSearchQuery(e.target.value)}
                      className="crm-search-input"
                    />
                    {ownerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setOwnerSearchQuery('')}
                        className="crm-search-clear-btn"
                        title="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Sort By Dropdown */}
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="crm-sort-dropdown-btn"
                      onClick={() => {
                        setOwnerSortDropdownOpen(prev => !prev);
                        setOwnerTagsDropdownOpen(false);
                      }}
                    >
                      <span>
                        Sort: {ownerSortBy === 'featured' ? 'Recommended' : ownerSortBy === 'price-asc' ? 'Price: Low to High' : ownerSortBy === 'price-desc' ? 'Price: High to Low' : 'Name (A–Z)'}
                      </span>
                      <ChevronDown size={13} />
                    </button>

                    {ownerSortDropdownOpen && (
                      <div className="fave-popover-menu right">
                        <button
                          type="button"
                          className={`fave-popover-item ${ownerSortBy === 'featured' ? 'active' : ''}`}
                          onClick={() => {
                            setOwnerSortBy('featured');
                            setOwnerSortDropdownOpen(false);
                          }}
                        >
                          <span>Recommended</span>
                          {ownerSortBy === 'featured' && <Check size={13} />}
                        </button>
                        <button
                          type="button"
                          className={`fave-popover-item ${ownerSortBy === 'price-asc' ? 'active' : ''}`}
                          onClick={() => {
                            setOwnerSortBy('price-asc');
                            setOwnerSortDropdownOpen(false);
                          }}
                        >
                          <span>Price: Low to High</span>
                          {ownerSortBy === 'price-asc' && <Check size={13} />}
                        </button>
                        <button
                          type="button"
                          className={`fave-popover-item ${ownerSortBy === 'price-desc' ? 'active' : ''}`}
                          onClick={() => {
                            setOwnerSortBy('price-desc');
                            setOwnerSortDropdownOpen(false);
                          }}
                        >
                          <span>Price: High to Low</span>
                          {ownerSortBy === 'price-desc' && <Check size={13} />}
                        </button>
                        <button
                          type="button"
                          className={`fave-popover-item ${ownerSortBy === 'name' ? 'active' : ''}`}
                          onClick={() => {
                            setOwnerSortBy('name');
                            setOwnerSortDropdownOpen(false);
                          }}
                        >
                          <span>Name (A–Z)</span>
                          {ownerSortBy === 'name' && <Check size={13} />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. 4-Column CRM Food Cards Grid */}
              {filteredOwnerMenu.length === 0 ? (
                <div className="crm-menu-empty-card">
                  <div className="crm-empty-icon-box">
                    <Coffee size={36} style={{ color: '#176B50' }} />
                  </div>
                  <h3>No Menu Items Found</h3>
                  <p>Try clearing filters or search query, or add a new menu item to your catalogue.</p>
                  <button
                    type="button"
                    className="crm-btn-primary"
                    onClick={() => {
                      cancelEdit();
                      setOwnerAddModalOpen(true);
                    }}
                    style={{ marginTop: 14 }}
                  >
                    <Plus size={15} />
                    <span>Add New Menu Item</span>
                  </button>
                </div>
              ) : (
                <div className="crm-menu-cards-grid">
                  {filteredOwnerMenu.map(i => {
                    const itemImg = getFaveItemVisual(i);
                    const itemKcal = getFaveItemKcal(i);
                    const itemRecipe = getFaveItemRecipe(i);

                    return (
                      <article className="crm-menu-card" key={i._id}>
                        <div
                          className="crm-card-media-box"
                          onClick={() => startEditItem(i)}
                          title="Click to edit item"
                        >
                          <img
                            src={itemImg}
                            alt={i.name}
                            className="crm-card-img"
                            loading="lazy"
                          />
                          <div className="crm-card-top-badges">
                            <span className={`crm-fssai-pill ${i.veg ? 'veg' : 'non-veg'}`}>
                              <span className="crm-fssai-dot" />
                              {i.veg ? 'VEG' : 'NON-VEG'}
                            </span>
                            <button
                              type="button"
                              className={`crm-card-status-pill ${i.available ? 'live' : 'hidden'}`}
                              onClick={e => {
                                e.stopPropagation();
                                toggleItemAvailability(i);
                              }}
                              title={i.available ? 'Click to hide from customer menu' : 'Click to make live on customer menu'}
                            >
                              <span className="crm-status-dot" />
                              {i.available ? 'Live' : 'Hidden'}
                            </button>
                          </div>
                        </div>

                        <div className="crm-card-body">
                          <div className="crm-card-header-clickable" onClick={() => startEditItem(i)}>
                            <h4 className="crm-card-title">{i.name}</h4>
                            <p className="crm-card-desc">{itemRecipe}</p>
                          </div>

                          <div className="crm-card-price-row">
                            <span className="crm-card-price">{money(i.price)}</span>
                            <span className="crm-card-kcal">{itemKcal}</span>
                          </div>

                          {((Array.isArray(i.variants) && i.variants.length > 0) || (Array.isArray(i.modifierGroups) && i.modifierGroups.length > 0)) && (
                            <div className="crm-card-tags-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 8px 0' }}>
                              {Array.isArray(i.variants) && i.variants.length > 0 && (
                                <span className="crm-card-tag-pill" title={`${i.variants.length} portion sizes available`}>
                                  {i.variants.length} Sizes
                                </span>
                              )}
                              {Array.isArray(i.modifierGroups) && i.modifierGroups.length > 0 && (
                                <span className="crm-card-tag-pill" title={`${i.modifierGroups.length} customization groups configured`}>
                                  {i.modifierGroups.length} Customizers
                                </span>
                              )}
                            </div>
                          )}

                          <div className="crm-card-actions">
                            <button
                              type="button"
                              className="crm-card-btn-edit"
                              onClick={() => startEditItem(i)}
                              title="Edit item details & photo"
                            >
                              <Pencil size={13} />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              className="crm-card-btn-delete"
                              onClick={() => deleteItem(i._id)}
                              title="Delete item from menu"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* QR Code Modal for Owner */}
            {ownerQrModalOpen && (
              <div className="fave-modal-backdrop" onClick={() => setOwnerQrModalOpen(false)}>
                <div className="fave-modal-card" onClick={e => e.stopPropagation()}>
                  <div className="fave-modal-header">
                    <h3 className="fave-modal-title">Live Menu QR Code</h3>
                    <button
                      type="button"
                      className="fave-modal-close-btn"
                      onClick={() => setOwnerQrModalOpen(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 20, display: 'inline-block', border: '1px solid #e2e8f0' }}>
                      <QRCodeSVG
                        value={`${window.location.origin}/cafe/${data?.cafe?.slug || ''}`}
                        size={200}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    <h4 style={{ margin: '16px 0 6px 0', fontSize: 18, color: '#0f172a' }}>
                      {data?.cafe?.name || 'Chill Bar'} Digital Menu
                    </h4>
                    <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 20px 0' }}>
                      Customers can scan this code to browse the live menu and place contactless orders.
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="fave-pill-btn-manage"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => {
                          const url = `${window.location.origin}/cafe/${data?.cafe?.slug || ''}`;
                          navigator.clipboard.writeText(url);
                          setError('Public menu URL copied to clipboard!');
                          setOwnerQrModalOpen(false);
                        }}
                      >
                        <Copy size={15} />
                        <span>Copy Link</span>
                      </button>

                      <button
                        type="button"
                        className="fave-pill-btn-soft"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => {
                          setOwnerQrModalOpen(false);
                          setTab('qrKit');
                        }}
                      >
                        <QrCode size={15} />
                        <span>Open QR Print Kit</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Add / Edit Menu Item Modal Form with Customization Studio */}
            {ownerAddModalOpen && (
              <div className="fave-modal-backdrop" onClick={cancelEdit}>
                <div
                  className="fave-modal-card"
                  style={{ maxWidth: 740, maxHeight: '92vh', overflowY: 'auto' }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="fave-modal-header">
                    <div>
                      <h3 className="fave-modal-title">{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                        {editingItem ? `Editing "${editingItem.name}"` : 'Configure dish pricing, portion sizes, and customizations'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="fave-modal-close-btn"
                      onClick={cancelEdit}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* 3-Tab Navigator */}
                  <div className="menu-modal-tabs">
                    <button
                      type="button"
                      className={`menu-modal-tab-btn ${activeItemModalTab === 'details' ? 'active' : ''}`}
                      onClick={() => setActiveItemModalTab('details')}
                    >
                      <span>1. Dish Details</span>
                    </button>

                    <button
                      type="button"
                      className={`menu-modal-tab-btn ${activeItemModalTab === 'variants' ? 'active' : ''}`}
                      onClick={() => setActiveItemModalTab('variants')}
                    >
                      <span>2. Portions & Sizes</span>
                      {(item.variants || []).length > 0 && (
                        <span className="menu-modal-tab-badge">{(item.variants || []).length}</span>
                      )}
                    </button>

                    <button
                      type="button"
                      className={`menu-modal-tab-btn ${activeItemModalTab === 'modifiers' ? 'active' : ''}`}
                      onClick={() => setActiveItemModalTab('modifiers')}
                    >
                      <span>3. Customizations & Add-ons</span>
                      {(item.modifierGroups || []).length > 0 && (
                        <span className="menu-modal-tab-badge">{(item.modifierGroups || []).length}</span>
                      )}
                    </button>
                  </div>

                  <form onSubmit={saveItem}>
                    {/* TAB 1: BASIC DISH DETAILS */}
                    {activeItemModalTab === 'details' && (
                      <div className="theme-form-grid">
                        <label>
                          <span>Item Name</span>
                          <input
                            required
                            placeholder="e.g. Sandwich Tuna Plenty Special Tomato"
                            value={item.name}
                            onChange={e => setItem({ ...item, name: e.target.value })}
                          />
                        </label>

                        <label>
                          <span>Category</span>
                          <select
                            value={item.category}
                            onChange={e => setItem({ ...item, category: e.target.value })}
                          >
                            <option value="Coffee">Coffee & Brews</option>
                            <option value="Breakfasts">Breakfasts</option>
                            <option value="Mains">Mains</option>
                            <option value="Bites">Bites</option>
                            <option value="Dessert">Dessert & Fruits</option>
                            <option value="Beverages">Beverages & Teas</option>
                          </select>
                        </label>

                        <label>
                          <span>Base Price (INR)</span>
                          <input
                            required
                            type="number"
                            placeholder="250"
                            value={item.price}
                            onChange={e => setItem({ ...item, price: e.target.value })}
                          />
                        </label>

                        <label>
                          <span>Dietary Type</span>
                          <select
                            value={item.veg ? 'veg' : 'non-veg'}
                            onChange={e => setItem({ ...item, veg: e.target.value === 'veg' })}
                          >
                            <option value="veg">Vegetarian</option>
                            <option value="non-veg">Non-Vegetarian</option>
                          </select>
                        </label>

                        <label className="full-width">
                          <span>Recipe Ingredients & Description</span>
                          <textarea
                            rows={2}
                            placeholder="bread, eggs, butter, tomato, lettuce, cheese, mayonnaise..."
                            value={item.description}
                            onChange={e => setItem({ ...item, description: e.target.value })}
                          />
                        </label>

                        {/* Photo Upload & Preview Section */}
                        <div className="full-width photo-manager-section">
                          <div className="photo-manager-header">
                            <span>Item Photo</span>
                            {item.image && (
                              <button
                                type="button"
                                className="photo-remove-btn"
                                onClick={() => setItem({ ...item, image: '' })}
                              >
                                <Trash2 size={12} /> Remove
                              </button>
                            )}
                          </div>

                          {item.image ? (
                            <div className="photo-preview-card">
                              <img src={item.image} alt="Preview" className="photo-preview-img" />
                              <div className="photo-preview-info">
                                <span className="photo-preview-label">Active Item Photo</span>
                                <p className="photo-preview-sub">Displays on customer digital QR menu</p>
                                <button
                                  type="button"
                                  className="photo-change-btn"
                                  onClick={() => setItem({ ...item, image: '' })}
                                >
                                  Change Photo
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="photo-input-container">
                              <div className="photo-upload-zone">
                                <input
                                  type="file"
                                  id="menu-photo-file-input"
                                  accept="image/*"
                                  onChange={handlePhotoUpload}
                                  style={{ display: 'none' }}
                                />
                                <label htmlFor="menu-photo-file-input" className="photo-upload-button-label">
                                  <Upload size={18} />
                                  <span>Upload Photo from Computer</span>
                                  <small>PNG, JPG, WebP up to 5MB</small>
                                </label>
                              </div>

                              <div className="photo-url-divider">
                                <span>OR ENTER IMAGE URL</span>
                              </div>

                              <div className="photo-url-input-wrap">
                                <ImageIcon size={15} className="url-icon" />
                                <input
                                  type="url"
                                  placeholder="https://images.unsplash.com/..."
                                  value={item.image}
                                  onChange={e => setItem({ ...item, image: e.target.value })}
                                />
                              </div>

                              <div className="photo-presets-block">
                                <span className="presets-label">Quick Presets:</span>
                                <div className="photo-presets-pills">
                                  {photoPresets.map(preset => (
                                    <button
                                      key={preset.name}
                                      type="button"
                                      className="preset-chip"
                                      onClick={() => setItem({ ...item, image: preset.url })}
                                    >
                                      + {preset.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 2: PORTIONS & SIZES (VARIANTS) */}
                    {activeItemModalTab === 'variants' && (
                      <div className="menu-variants-tab-content">
                        <div className="menu-customizer-banner">
                          <h4>Portions & Serving Sizes</h4>
                          <p>
                            Configure optional sizes (e.g. Regular 250ml vs Large 350ml, or Personal vs Medium Pizza).
                            When variants are configured, customers pick their preferred size on the QR menu.
                          </p>
                          <div className="menu-customizer-presets-row">
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#176B50' }}>Quick Templates:</span>
                            <button
                              type="button"
                              className="menu-preset-chip-btn"
                              onClick={() => applyVariantPreset('coffee')}
                            >
                              + Coffee Volumes (250ml / 350ml)
                            </button>
                            <button
                              type="button"
                              className="menu-preset-chip-btn"
                              onClick={() => applyVariantPreset('pizza')}
                            >
                              + Pizza Sizes (7" / 10" / 12")
                            </button>
                            <button
                              type="button"
                              className="menu-preset-chip-btn"
                              onClick={() => applyVariantPreset('portions')}
                            >
                              + Half / Full Portion
                            </button>
                          </div>
                        </div>

                        {(item.variants || []).length === 0 ? (
                          <div className="menu-empty-customizer-state">
                            <p style={{ margin: 0, fontWeight: 600 }}>No portion sizes added yet.</p>
                            <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>
                              The dish will be sold at its standard base price (₹{item.price || 0}). Click below or use a template to add sizes.
                            </p>
                          </div>
                        ) : (
                          <div className="menu-variants-list" style={{ marginBottom: 16 }}>
                            {(item.variants || []).map((v, vIdx) => (
                              <div key={v.id || vIdx} className="menu-variant-item-card">
                                <span className="menu-variant-index">#{vIdx + 1}</span>
                                <input
                                  type="text"
                                  className="menu-variant-name-input"
                                  placeholder="Size Name (e.g. Regular 250ml, Large 350ml)"
                                  value={v.name}
                                  onChange={e => updateVariant(vIdx, 'name', e.target.value)}
                                  required
                                />
                                <div className="menu-variant-price-wrap">
                                  <span>₹</span>
                                  <input
                                    type="number"
                                    placeholder="Price"
                                    value={v.price}
                                    onChange={e => updateVariant(vIdx, 'price', e.target.value)}
                                    required
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="menu-action-icon-btn"
                                  onClick={() => removeVariant(vIdx)}
                                  title="Remove this size"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          className="menu-add-btn-primary-outline"
                          onClick={() => addVariant('', item.price || '')}
                        >
                          <Plus size={15} /> Add Portion / Size
                        </button>
                      </div>
                    )}

                    {/* TAB 3: CUSTOMIZATIONS & ADD-ONS (MODIFIER GROUPS) */}
                    {activeItemModalTab === 'modifiers' && (
                      <div className="menu-modifiers-tab-content">
                        <div className="menu-customizer-banner">
                          <h4>Customization Groups & Add-ons</h4>
                          <p>
                            Let diners customize ingredients like Choice of Milk (Oat/Almond), Syrups & Shots, Extra Toppings, or Bread Selection with custom pricing.
                          </p>
                          <div className="menu-customizer-presets-row">
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#176B50' }}>Popular Add-on Packs:</span>
                            <button
                              type="button"
                              className="menu-preset-chip-btn"
                              onClick={() => applyModifierPreset('milk')}
                            >
                              + Choice of Milk (Oat, Almond, Soy)
                            </button>
                            <button
                              type="button"
                              className="menu-preset-chip-btn"
                              onClick={() => applyModifierPreset('syrups')}
                            >
                              + Syrups & Shots
                            </button>
                            <button
                              type="button"
                              className="menu-preset-chip-btn"
                              onClick={() => applyModifierPreset('toppings')}
                            >
                              + Extra Toppings
                            </button>
                            <button
                              type="button"
                              className="menu-preset-chip-btn"
                              onClick={() => applyModifierPreset('bread')}
                            >
                              + Bread Selection
                            </button>
                          </div>
                        </div>

                        {(item.modifierGroups || []).length === 0 ? (
                          <div className="menu-empty-customizer-state">
                            <p style={{ margin: 0, fontWeight: 600 }}>No customization groups configured.</p>
                            <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>
                              Add modifier groups (like milk choice or extra toppings) or click a quick template above.
                            </p>
                          </div>
                        ) : (
                          <div className="menu-modifiers-list" style={{ marginBottom: 16 }}>
                            {(item.modifierGroups || []).map((grp, gIdx) => (
                              <div key={grp.id || gIdx} className="menu-modifier-group-card">
                                <div className="menu-modifier-group-header">
                                  <input
                                    type="text"
                                    className="menu-modifier-group-title-input"
                                    placeholder="Group Name (e.g. Choice of Milk, Extra Cheese)"
                                    value={grp.name}
                                    onChange={e => updateModifierGroup(gIdx, 'name', e.target.value)}
                                    required
                                  />
                                  <button
                                    type="button"
                                    className="menu-action-icon-btn"
                                    onClick={() => removeModifierGroup(gIdx)}
                                    title="Delete group"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>

                                <div className="menu-modifier-group-controls">
                                  <label className="menu-mod-radio-label">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(grp.required)}
                                      onChange={e => {
                                        const req = e.target.checked;
                                        updateModifierGroup(gIdx, 'required', req);
                                        updateModifierGroup(gIdx, 'minSelect', req ? 1 : 0);
                                      }}
                                    />
                                    <span>Mandatory / Required Selection</span>
                                  </label>

                                  <div className="menu-mod-max-select-wrap">
                                    <span>Max allowed options:</span>
                                    <input
                                      type="number"
                                      min="1"
                                      max="10"
                                      value={grp.maxSelect || 1}
                                      onChange={e => updateModifierGroup(gIdx, 'maxSelect', Math.max(1, Number(e.target.value) || 1))}
                                    />
                                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                      ({Number(grp.maxSelect) === 1 ? 'Single choice radio' : 'Multi-select checkboxes'})
                                    </span>
                                  </div>
                                </div>

                                <div className="menu-options-container">
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#17211D' }}>
                                    Options & Extra Price:
                                  </span>
                                  {(grp.options || []).map((opt, oIdx) => (
                                    <div key={opt.id || oIdx} className="menu-option-row-item">
                                      <input
                                        type="text"
                                        className="menu-option-name-input"
                                        placeholder="Option Name (e.g. Oat Milk, Extra Hazelnut)"
                                        value={opt.name}
                                        onChange={e => updateGroupOption(gIdx, oIdx, 'name', e.target.value)}
                                        required
                                      />
                                      <input
                                        type="number"
                                        className="menu-option-price-input"
                                        placeholder="Extra ₹ (0 for free)"
                                        value={opt.price}
                                        onChange={e => updateGroupOption(gIdx, oIdx, 'price', e.target.value)}
                                        required
                                      />
                                      <button
                                        type="button"
                                        className="menu-action-icon-btn"
                                        onClick={() => removeGroupOption(gIdx, oIdx)}
                                        title="Remove option"
                                        style={{ width: 28, height: 28 }}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  ))}

                                  <button
                                    type="button"
                                    className="menu-add-option-btn"
                                    onClick={() => addGroupOption(gIdx)}
                                  >
                                    <Plus size={13} /> Add Option to "{grp.name || 'Group'}"
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          className="menu-add-btn-primary-outline"
                          onClick={() => addModifierGroup('New Customization Group', false, 1, [])}
                        >
                          <Plus size={15} /> Add Customization Group
                        </button>
                      </div>
                    )}

                    {/* Bottom Submit Actions */}
                    <div className="form-submit-actions full-width" style={{ marginTop: 20 }}>
                      <button className="crm-btn-primary full-width" type="submit">
                        {editingItem ? (
                          <>
                            <Check size={16} /> Save Changes
                          </>
                        ) : (
                          <>
                            <Plus size={16} /> Add to Live Menu
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="crm-btn-secondary full-width"
                        onClick={cancelEdit}
                      >
                        <X size={15} /> Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB: INVENTORY & RECIPES (BOM & 86 ENGINE) ===================== */}
        {tab === 'inventory' && (isOwner || isManager) && (
          <div className="tab-pane-container" style={{ padding: '0 0 40px 0' }}>
            <Suspense fallback={<div role="status">Loading section...</div>}>
              <InventoryManager cafe={data?.cafe} token={getToken()} />
            </Suspense>
          </div>
        )}

        {/* ===================== TAB: ENTERPRISE & OMNICHANNEL CHANNELS (PHASE 5) ===================== */}
        {tab === 'enterprise' && (isOwner || isManager) && (
          <div className="tab-pane-container" style={{ padding: '0 0 40px 0' }}>
            <Suspense fallback={<div role="status">Loading section...</div>}>
              <OmnichannelManager
                cafe={data?.cafe}
                token={getToken()}
                onCafeSwitch={(newCafe) => {
                  fetchData();
                }}
              />
            </Suspense>
          </div>
        )}

        {/* ===================== TAB: HARDWARE & PERIPHERALS (PHASE 6) ===================== */}
        {tab === 'hardware' && (isOwner || isManager) && (
          <div className="tab-pane-container" style={{ padding: '0 0 40px 0' }}>
            <Suspense fallback={<div role="status">Loading section...</div>}>
              <HardwareManager
                cafe={data?.cafe}
                token={getToken()}
              />
            </Suspense>
          </div>
        )}

        {/* ===================== TAB: GST & TALLY ERP SYNC (PHASE 9) ===================== */}
        {tab === 'gst' && (isOwner || isManager) && (
          <div className="tab-pane-container" style={{ padding: '0 0 40px 0' }}>
            <Suspense fallback={<div role="status">Loading section...</div>}>
              <GstTallyManager
                cafe={data?.cafe}
                token={getToken()}
              />
            </Suspense>
          </div>
        )}

        {/* ===================== TAB: CENTRAL COMMISSARY & INDENTS ===================== */}
        {tab === 'commissary' && (isOwner || isManager) && (
          <div className="tab-pane-container" style={{ padding: '0 0 40px 0' }}>
            <Suspense fallback={<div role="status">Loading section...</div>}>
              <CommissaryManager
                cafe={data?.cafe}
                token={getToken()}
              />
            </Suspense>
          </div>
        )}

        {/* ===================== TAB: STAFF OPERATIONS & TIP PAYROLL ===================== */}
        {tab === 'staff-ops' && (isOwner || isManager) && (
          <div className="tab-pane-container" style={{ padding: '0 0 40px 0' }}>
            <Suspense fallback={<div role="status">Loading section...</div>}>
              <StaffOperationsManager
                cafe={data?.cafe}
                token={getToken()}
                staffList={staffList}
              />
            </Suspense>
          </div>
        )}

        {/* ===================== TAB: AI ROASTERY OPERATING SYSTEM ===================== */}
        {tab === 'ai-roastery' && (isOwner || isManager) && (
          <div className="tab-pane-container" style={{ padding: '0 0 40px 0' }}>
            <Suspense fallback={<div role="status">Loading section...</div>}>
              <AiRoasteryManager
                cafe={data?.cafe}
                token={getToken()}
              />
            </Suspense>
          </div>
        )}

        {/* ===================== TAB: CUSTOMERS (CRM & GUEST INTELLIGENCE) ===================== */}
        {tab === 'customers' && (
          <div className="tab-pane-container" style={{ padding: '0 0 40px 0' }}>
            <div className="crm-orders-wrapper crm-customer-directory">
              {/* 1. Header Card */}
              <div className="crm-orders-header-card">
                <div className="crm-orders-header-left">
                  <div className="crm-orders-header-title-row">
                    <h2 className="crm-orders-title">Guest Directory & Loyalty CRM</h2>
                    <span className="crm-live-pill">
                      <span className="crm-pulse-dot" />
                      {data.customers?.length || 0} Registered Diners
                    </span>
                  </div>
                  <p className="crm-orders-subtitle">
                    Track dining frequencies, milestone progress, lifetime expenditure, and personalized guest preferences.
                  </p>
                </div>

                <div className="crm-orders-header-actions">
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    disabled={exportingCustomersCSV}
                    onClick={handleExportCustomersCSV}
                    title="Export customer directory to CSV"
                  >
                    <Download size={14} className={exportingCustomersCSV ? 'spin' : ''} />
                    <span>{exportingCustomersCSV ? 'Exporting…' : 'Export CSV'}</span>
                  </button>
                  <button
                    type="button"
                    className="crm-btn-primary"
                    onClick={() => openManualOrderModal(null)}
                    title="Create a new manual dine-in or takeaway order"
                  >
                    <Plus size={15} />
                    <span>New Manual Order</span>
                  </button>
                </div>
              </div>

              {/* 2. Key Metrics Grid */}
              <div className="crm-orders-metrics-grid">
                <div className="crm-metric-card">
                  <div className="crm-metric-icon-wrap cognac">
                    <Users size={20} />
                  </div>
                  <div className="crm-metric-info">
                    <span className="crm-metric-label">Total Registered Diners</span>
                    <div className="crm-metric-val-row">
                      <h3 className="crm-metric-value">{data.customers?.length || 0}</h3>
                    </div>
                    <span className="crm-metric-hint success">
                      <TrendingUp size={11} style={{ display: 'inline', marginRight: 4 }} />
                      Enrolled in café rewards
                    </span>
                  </div>
                </div>

                <div className="crm-metric-card">
                  <div className="crm-metric-icon-wrap orange">
                    <Coins size={20} />
                  </div>
                  <div className="crm-metric-info">
                    <span className="crm-metric-label">Diner Lifetime Spend</span>
                    <div className="crm-metric-val-row">
                      <h3 className="crm-metric-value">
                        {money((data.customers || []).reduce((s, c) => s + (c.totalSpend || 0), 0))}
                      </h3>
                    </div>
                    <span className="crm-metric-hint">Total cumulative revenue</span>
                  </div>
                </div>

                <div className="crm-metric-card">
                  <div className="crm-metric-icon-wrap green">
                    <ShoppingBag size={20} />
                  </div>
                  <div className="crm-metric-info">
                    <span className="crm-metric-label">Average Spend / Diner</span>
                    <div className="crm-metric-val-row">
                      <h3 className="crm-metric-value">
                        {money(
                          data.customers?.length
                            ? Math.round(
                                (data.customers || []).reduce((s, c) => s + (c.totalSpend || 0), 0) /
                                  data.customers.length
                              )
                            : 0
                        )}
                      </h3>
                    </div>
                    <span className="crm-metric-hint">Historical lifetime AOV</span>
                  </div>
                </div>

                <div className="crm-metric-card">
                  <div className="crm-metric-icon-wrap gold">
                    <Gift size={20} />
                  </div>
                  <div className="crm-metric-info">
                    <span className="crm-metric-label">Reward Ready & VIPs</span>
                    <div className="crm-metric-val-row">
                      <h3 className="crm-metric-value">
                        {(data.customers || []).filter(
                          c =>
                            (c.totalSpend || 0) >= 1000 ||
                            (c.visits || 0) >= (data.cafe?.loyalty?.visitsRequired || 8) ||
                            (c.activeRewardsCount || 0) > 0
                        ).length}
                      </h3>
                    </div>
                    <span className="crm-metric-hint warning">
                      Eligible for perks & redemption
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Toolbar Card: Segment Filters & Search */}
              <div className="crm-orders-toolbar-card">
                <div className="crm-orders-toolbar-left">
                  <div className="crm-orders-status-tabs">
                    <button
                      type="button"
                      className={`crm-status-tab-btn ${customerSegment === 'all' ? 'active' : ''}`}
                      onClick={() => setCustomerSegment('all')}
                    >
                      <Users size={13} />
                      <span>All Diners</span>
                      <span className="crm-tab-badge">{data.customers?.length || 0}</span>
                    </button>
                    <button
                      type="button"
                      className={`crm-status-tab-btn ${customerSegment === 'vip' ? 'active' : ''}`}
                      onClick={() => setCustomerSegment('vip')}
                    >
                      <Star size={13} fill={customerSegment === 'vip' ? '#ffffff' : '#f59e0b'} color={customerSegment === 'vip' ? '#ffffff' : '#f59e0b'} />
                      <span>VIPs (₹1,000+)</span>
                    </button>
                    <button
                      type="button"
                      className={`crm-status-tab-btn ${customerSegment === 'reward_ready' ? 'active' : ''}`}
                      onClick={() => setCustomerSegment('reward_ready')}
                    >
                      <Gift size={13} />
                      <span>Reward Ready</span>
                    </button>
                    <button
                      type="button"
                      className={`crm-status-tab-btn ${customerSegment === 'frequent' ? 'active' : ''}`}
                      onClick={() => setCustomerSegment('frequent')}
                    >
                      <Flame size={13} />
                      <span>Frequent (3+ visits)</span>
                    </button>
                  </div>
                </div>

                <div className="crm-orders-toolbar-right">
                  <div className="crm-orders-search-box">
                    <Search size={15} className="crm-search-icon" />
                    <input
                      type="text"
                      placeholder="Search by diner name, phone, or email…"
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      className="crm-orders-search-input"
                    />
                    {customerSearch && (
                      <button
                        type="button"
                        className="crm-search-clear-btn"
                        onClick={() => setCustomerSearch('')}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Customers Table */}
              <div className="crm-table-container">
                {filteredCustomers.length === 0 ? (
                  <div className="crm-empty-table-state" style={{ padding: '60px 20px' }}>
                    <Users size={42} style={{ color: '#176B50', opacity: 0.6, marginBottom: 12 }} />
                    <h4>No Diner Profiles Found</h4>
                    <p>
                      {customerSearch
                        ? `No diners match your query "${customerSearch}". Try clearing the search.`
                        : 'No customer profiles match this segment filter.'}
                    </p>
                    <button
                      type="button"
                      className="crm-btn-primary"
                      onClick={() => openManualOrderModal(null)}
                      style={{ marginTop: 14 }}
                    >
                      <Plus size={16} /> New Walk-In Order
                    </button>
                  </div>
                ) : (
                  <div className="crm-table-responsive-wrapper">
                    <table className="crm-orders-table crm-customer-table">
                      <thead>
                        <tr>
                          <th>DINER PROFILE</th>
                          <th>CONTACT</th>
                          <th>LIFETIME SPEND</th>
                          <th>VISITS & MILESTONE</th>
                          <th>REWARD STATUS</th>
                          <th style={{ whiteSpace: 'nowrap' }}>LAST VISIT</th>
                          <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.map(c => {
                          const avatar = getAvatarColor(c.name?.[0] || 'G');
                          const visitsReq = data.cafe?.loyalty?.visitsRequired || 8;
                          const isRewardReady = (c.visits || 0) >= visitsReq || (c.activeRewardsCount || 0) > 0;
                          const isVip = (c.totalSpend || 0) >= 1000;
                          const progressPct = Math.min(100, Math.round(((c.visits || 0) / visitsReq) * 100));

                          return (
                            <tr
                              key={c._id || c.id}
                              className="crm-orders-row"
                              style={{ cursor: 'pointer' }}
                              onClick={() => openCustomerProfile(c)}
                            >
                              <td className="cell-customer" data-label="Diner profile">
                                <div
                                  className="crm-customer-avatar-box"
                                  style={{ background: avatar.bg, color: avatar.text }}
                                >
                                  {(c.name?.[0] || 'G').toUpperCase()}
                                </div>
                                <div className="crm-customer-meta">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span className="crm-customer-name">{c.name || 'Valued Guest'}</span>
                                    {isVip && (
                                      <span
                                        className="crm-status-pill"
                                        style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '10px', padding: '1px 6px' }}
                                      >
                                        ⭐ VIP
                                      </span>
                                    )}
                                  </div>
                                  {c.email && <span className="crm-customer-phone">{c.email}</span>}
                                  {c.notes && (
                                    <small style={{ color: '#8c8279', fontStyle: 'italic', marginTop: 2, display: 'block' }}>
                                      "{c.notes}"
                                    </small>
                                  )}
                                </div>
                              </td>

                              <td data-label="Contact" style={{ whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a120c' }}>
                                    {c.phone || '—'}
                                  </span>
                                  {c.phone && (
                                    <a
                                      href={`https://wa.me/91${c.phone.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      style={{ fontSize: '11px', color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}
                                    >
                                      <Send size={10} /> WhatsApp
                                    </a>
                                  )}
                                </div>
                              </td>

                              <td data-label="Lifetime spend" style={{ whiteSpace: 'nowrap' }}>
                                <div className="crm-order-amount">{money(c.totalSpend)}</div>
                                <span className="crm-order-ref-time">
                                  {c.ordersCount || 0} order(s)
                                </span>
                              </td>

                              <td data-label="Visits & milestone">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 120 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#1a120c' }}>
                                    <span>{c.visits || 0} / {visitsReq} visits</span>
                                    <span style={{ color: '#7b3d22' }}>{progressPct}%</span>
                                  </div>
                                  <div style={{ width: '100%', height: 6, background: '#f3eeea', borderRadius: 999, overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        height: '100%',
                                        width: `${progressPct}%`,
                                        background: progressPct >= 100 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #176B50, #123D32)',
                                        borderRadius: 999,
                                        transition: 'width 0.3s ease'
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>

                              <td data-label="Reward status" style={{ whiteSpace: 'nowrap' }}>
                                {isRewardReady ? (
                                  <span className="crm-status-pill payment paid" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                                    <Gift size={11} /> REWARD READY
                                  </span>
                                ) : (
                                  <span className="crm-status-pill" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', fontSize: '11px', fontWeight: 700 }}>
                                    IN PROGRESS
                                  </span>
                                )}
                              </td>

                              <td data-label="Last visit" style={{ whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: '12.5px', color: '#7d736b', fontWeight: 600 }}>
                                  {getTimeAgo(c.lastVisit)}
                                </span>
                              </td>

                              <td data-label="Actions" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div className="crm-table-action-cell" onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="crm-customer-order-btn"
                                    title={`Create order for ${c.name || 'guest'}`}
                                    onClick={() => openManualOrderModal(c)}
                                  >
                                    <Plus size={13} />
                                    <span>Order</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="crm-customer-timeline-btn"
                                    onClick={() => openCustomerProfile(c)}
                                    title="View full customer profile and dining history"
                                  >
                                    <span>Timeline</span>
                                    <ChevronRight size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: ANALYTICS (PHASE 5) ===================== */}
        {tab === 'analytics' && (
          <div className="tab-pane-container">
            {/* Header with Title, Range Switcher & CSV Exports */}
            <div className="analytics-header-card">
              <div className="analytics-header-info">
                <div className="analytics-title-row">
                  <div className="analytics-icon-badge">
                    <BarChart3 size={22} />
                  </div>
                  <div>
                    <h2 className="analytics-main-title">Business & Retention Intelligence</h2>
                    <p className="analytics-main-subtitle">
                      Live revenue trajectories, peak dining rush hours, repeat diner retention, and loyalty ROI
                    </p>
                  </div>
                </div>
              </div>

              <div className="analytics-header-actions">
                {/* Range Selector */}
                <div className="analytics-range-pills">
                  {[
                    { id: '7d', label: '7 Days' },
                    { id: '30d', label: '30 Days' },
                    { id: '90d', label: '90 Days' },
                    { id: 'year', label: 'Past Year' },
                  ].map(r => (
                    <button
                      key={r.id}
                      type="button"
                      className={`range-pill-btn ${analyticsRange === r.id ? 'active' : ''}`}
                      onClick={() => {
                        setAnalyticsRange(r.id);
                        fetchAnalytics(r.id);
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                {/* Refresh Button */}
                <button
                  type="button"
                  className="crm-btn-secondary"
                  title="Refresh analytics data"
                  disabled={loadingAnalytics}
                  onClick={() => fetchAnalytics(analyticsRange)}
                >
                  <RefreshCw size={15} className={loadingAnalytics ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>

                {/* CSV Export Dropdown / Buttons */}
                <div className="analytics-export-group">
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    title="Download complete order transactions as CSV"
                    disabled={exportingOrdersCSV}
                    onClick={handleExportOrdersCSV}
                  >
                    <Download size={15} className={exportingOrdersCSV ? 'spin' : ''} />
                    <span>{exportingOrdersCSV ? 'Exporting...' : 'Orders CSV'}</span>
                  </button>

                  <button
                    type="button"
                    className="crm-btn-secondary"
                    title="Download customer directory with spend and stamps as CSV"
                    disabled={exportingCustomersCSV}
                    onClick={handleExportCustomersCSV}
                  >
                    <Download size={15} className={exportingCustomersCSV ? 'spin' : ''} />
                    <span>{exportingCustomersCSV ? 'Exporting...' : 'Customers CSV'}</span>
                  </button>
                </div>
              </div>
            </div>

            {loadingAnalytics && !analyticsData ? (
              <div className="analytics-loading-box">
                <RefreshCw size={36} className="spin text-gold" />
                <p>Aggregating café sales, rush hours, and customer retention metrics...</p>
              </div>
            ) : !analyticsData ? (
              <div className="analytics-loading-box">
                <AlertCircle size={36} className="text-red" />
                <p>Unable to load analytics. Please try refreshing.</p>
              </div>
            ) : (
              <>
                {/* 1. Hero KPI Metric Cards with Comparative Deltas */}
                <div className="analytics-kpi-grid">
                  <div className="analytics-kpi-card">
                    <div className="kpi-card-header">
                      <span className="kpi-card-label">Total Revenue</span>
                      <div className="kpi-card-icon-box bg-orange-soft">
                        <Coins size={18} className="text-orange" />
                      </div>
                    </div>
                    <div className="kpi-card-body">
                      <h3 className="kpi-card-value">{money(analyticsData.kpi.revenue)}</h3>
                      <div className="kpi-card-delta-row">
                        <span
                          className={`delta-badge ${
                            analyticsData.kpi.revenueDelta >= 0 ? 'delta-positive' : 'delta-negative'
                          }`}
                        >
                          {analyticsData.kpi.revenueDelta >= 0 ? (
                            <ArrowUpRight size={13} />
                          ) : (
                            <ArrowDownRight size={13} />
                          )}
                          {Math.abs(analyticsData.kpi.revenueDelta)}% vs prior
                        </span>
                        <span className="delta-subtext">From {analyticsData.kpi.orders} paid orders</span>
                      </div>
                    </div>
                  </div>

                  <div className="analytics-kpi-card">
                    <div className="kpi-card-header">
                      <span className="kpi-card-label">Paid Orders Volume</span>
                      <div className="kpi-card-icon-box bg-blue-soft">
                        <ShoppingBag size={18} className="text-blue" />
                      </div>
                    </div>
                    <div className="kpi-card-body">
                      <h3 className="kpi-card-value">{analyticsData.kpi.orders} Orders</h3>
                      <div className="kpi-card-delta-row">
                        <span
                          className={`delta-badge ${
                            analyticsData.kpi.ordersDelta >= 0 ? 'delta-positive' : 'delta-negative'
                          }`}
                        >
                          {analyticsData.kpi.ordersDelta >= 0 ? (
                            <ArrowUpRight size={13} />
                          ) : (
                            <ArrowDownRight size={13} />
                          )}
                          {Math.abs(analyticsData.kpi.ordersDelta)}% vs prior
                        </span>
                        <span className="delta-subtext">In {analyticsData.period.days} days window</span>
                      </div>
                    </div>
                  </div>

                  <div className="analytics-kpi-card">
                    <div className="kpi-card-header">
                      <span className="kpi-card-label">Average Order Value (AOV)</span>
                      <div className="kpi-card-icon-box bg-purple-soft">
                        <TrendingUp size={18} className="text-purple" />
                      </div>
                    </div>
                    <div className="kpi-card-body">
                      <h3 className="kpi-card-value">{money(analyticsData.kpi.aov)}</h3>
                      <div className="kpi-card-delta-row">
                        <span
                          className={`delta-badge ${
                            analyticsData.kpi.aovDelta >= 0 ? 'delta-positive' : 'delta-negative'
                          }`}
                        >
                          {analyticsData.kpi.aovDelta >= 0 ? (
                            <ArrowUpRight size={13} />
                          ) : (
                            <ArrowDownRight size={13} />
                          )}
                          {Math.abs(analyticsData.kpi.aovDelta)}% vs prior
                        </span>
                        <span className="delta-subtext">Per completed transaction</span>
                      </div>
                    </div>
                  </div>

                  <div className="analytics-kpi-card">
                    <div className="kpi-card-header">
                      <span className="kpi-card-label">Repeat Customer Rate</span>
                      <div className="kpi-card-icon-box bg-green-soft">
                        <Users size={18} className="text-green" />
                      </div>
                    </div>
                    <div className="kpi-card-body">
                      <h3 className="kpi-card-value">{analyticsData.retention.repeatRate}%</h3>
                      <div className="kpi-card-delta-row">
                        <span className="delta-badge delta-positive">
                          <CheckCircle2 size={13} />
                          {analyticsData.retention.repeatDiners} repeat diners
                        </span>
                        <span className="delta-subtext">
                          of {analyticsData.retention.totalCustomers} total unique diners
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Interactive Revenue & Orders Trend Area Chart */}
                <div className="panel-box analytics-chart-panel">
                  <div className="panel-header-row">
                    <div>
                      <h3 className="panel-title">Revenue Trajectory & Daily Orders</h3>
                      <p className="panel-sub">
                        Daily cash flow and completed order volumes over the selected {analyticsRange.toUpperCase()} period
                      </p>
                    </div>
                    <div className="chart-legend-box">
                      <div className="legend-indicator">
                        <span className="legend-dot bg-orange"></span>
                        <span>Daily Revenue (INR)</span>
                      </div>
                      <div className="legend-indicator">
                        <span className="legend-dot bg-blue"></span>
                        <span>Completed Orders</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG Area & Line Chart */}
                  <div className="analytics-svg-chart-container">
                    {(() => {
                      const trends = analyticsData.trends || [];
                      if (!trends.length) return <p className="no-data-text">No trend data available for this range</p>;

                      const maxRev = Math.max(...trends.map(t => t.revenue), 100);
                      const maxOrders = Math.max(...trends.map(t => t.orders), 5);
                      const svgWidth = 860;
                      const svgHeight = 220;
                      const padLeft = 45;
                      const padRight = 20;
                      const padTop = 20;
                      const padBottom = 35;
                      const plotW = svgWidth - padLeft - padRight;
                      const plotH = svgHeight - padTop - padBottom;

                      const getX = idx => padLeft + (idx / Math.max(trends.length - 1, 1)) * plotW;
                      const getYRev = rev => padTop + plotH - (rev / maxRev) * plotH;

                      const pointsRev = trends.map((t, i) => `${getX(i)},${getYRev(t.revenue)}`).join(' ');
                      const areaPath = `M ${getX(0)},${padTop + plotH} ${pointsRev} L ${getX(trends.length - 1)},${padTop + plotH} Z`;
                      const linePath = `M ${pointsRev}`;

                      return (
                        <div className="svg-chart-wrapper">
                          <svg
                            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                            className="analytics-trend-svg"
                            preserveAspectRatio="none"
                          >
                            <defs>
                              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#e65100" stopOpacity="0.38" />
                                <stop offset="100%" stopColor="#e65100" stopOpacity="0.01" />
                              </linearGradient>
                            </defs>

                            {/* Background Grid Lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                              const y = padTop + plotH * (1 - pct);
                              const labelVal = Math.round(maxRev * pct);
                              return (
                                <g key={i}>
                                  <line
                                    x1={padLeft}
                                    y1={y}
                                    x2={svgWidth - padRight}
                                    y2={y}
                                    stroke="var(--border-color, #e5e7eb)"
                                    strokeDasharray="4 4"
                                    strokeWidth="1"
                                  />
                                  <text
                                    x={padLeft - 8}
                                    y={y + 4}
                                    fontSize="10"
                                    textAnchor="end"
                                    fill="var(--text-muted, #9ca3af)"
                                  >
                                    ₹{labelVal >= 1000 ? `${(labelVal / 1000).toFixed(1)}k` : labelVal}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Area Fill */}
                            <path d={areaPath} fill="url(#revenueGradient)" />

                            {/* Line Stroke */}
                            <path
                              d={linePath}
                              fill="none"
                              stroke="#e65100"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {/* Data points & Interactive Hover */}
                            {trends.map((t, idx) => {
                              const cx = getX(idx);
                              const cy = getYRev(t.revenue);
                              const isHovered = hoveredTrend?.date === t.date;
                              return (
                                <g key={t.date}>
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={isHovered ? 6 : t.revenue > 0 ? 3.5 : 2}
                                    fill={isHovered ? '#b23b00' : '#e65100'}
                                    stroke="#fff"
                                    strokeWidth="2"
                                    className="chart-data-circle"
                                    onMouseEnter={() => setHoveredTrend(t)}
                                    onMouseLeave={() => setHoveredTrend(null)}
                                  />
                                </g>
                              );
                            })}

                            {/* X Axis Date Labels */}
                            {trends
                              .filter((_, idx) => {
                                if (trends.length <= 10) return true;
                                if (trends.length <= 31) return idx % 5 === 0 || idx === trends.length - 1;
                                return idx % 15 === 0 || idx === trends.length - 1;
                              })
                              .map(t => {
                                const idx = trends.findIndex(x => x.date === t.date);
                                const x = getX(idx);
                                return (
                                  <text
                                    key={t.date}
                                    x={x}
                                    y={svgHeight - 10}
                                    fontSize="10"
                                    textAnchor="middle"
                                    fill="var(--text-muted, #6b7280)"
                                  >
                                    {t.label}
                                  </text>
                                );
                              })}
                          </svg>

                          {/* Interactive Tooltip Card */}
                          {hoveredTrend && (
                            <div className="chart-floating-tooltip">
                              <span className="tooltip-date">{hoveredTrend.label} ({hoveredTrend.date})</span>
                              <div className="tooltip-val-row">
                                <span className="tooltip-label">Daily Revenue:</span>
                                <span className="tooltip-val text-orange">{money(hoveredTrend.revenue)}</span>
                              </div>
                              <div className="tooltip-val-row">
                                <span className="tooltip-label">Paid Orders:</span>
                                <span className="tooltip-val text-blue">{hoveredTrend.orders}</span>
                              </div>
                              {hoveredTrend.orders > 0 && (
                                <div className="tooltip-val-row">
                                  <span className="tooltip-label">Daily AOV:</span>
                                  <span className="tooltip-val text-purple">{money(hoveredTrend.aov)}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* 3. Peak Dining Hours & Busiest Days */}
                <div className="analytics-two-col-grid">
                  {/* Dining Rush Hours Histogram */}
                  <div className="panel-box">
                    <div className="panel-header-row">
                      <div>
                        <h3 className="panel-title">Dining Rush Hours (Peak Times)</h3>
                        <p className="panel-sub">Hourly order frequency across 24 hours to optimize kitchen staffing</p>
                      </div>
                      <div className="peak-badge-note">
                        <Clock size={14} className="text-gold" />
                        <span>Golden bars indicate peak rush</span>
                      </div>
                    </div>

                    <div className="hourly-histogram-container">
                      {(() => {
                        const hours = analyticsData.peakHours || [];
                        const maxOrders = Math.max(...hours.map(h => h.orders), 1);
                        return (
                          <div className="hourly-bars-track">
                            {hours
                              .filter(h => h.hour >= 8 && h.hour <= 23) // Focus on café active hours 8 AM - 11 PM
                              .map(h => {
                                const heightPct = (h.orders / maxOrders) * 100;
                                const isHovered = hoveredHour?.hour === h.hour;
                                return (
                                  <div
                                    key={h.hour}
                                    className={`hourly-bar-col ${h.isPeak ? 'is-peak' : ''} ${
                                      isHovered ? 'hovered' : ''
                                    }`}
                                    onMouseEnter={() => setHoveredHour(h)}
                                    onMouseLeave={() => setHoveredHour(null)}
                                  >
                                    <div className="bar-pillar-wrap">
                                      <div
                                        className="bar-pillar"
                                        style={{ height: `${Math.max(heightPct, 6)}%` }}
                                      >
                                        {h.isPeak && <span className="peak-star-dot"><Star size={8} fill="#f59e0b" color="#f59e0b" /></span>}
                                      </div>
                                    </div>
                                    <span className="bar-hour-label">{h.label}</span>
                                    {h.orders > 0 && (
                                      <span className="bar-order-count">{h.orders}</span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        );
                      })()}

                      {hoveredHour && (
                        <div className="histogram-hover-box">
                          <strong>{hoveredHour.label}:</strong> {hoveredHour.orders} order
                          {hoveredHour.orders !== 1 ? 's' : ''} placed • {money(hoveredHour.revenue)} sales volume
                          {hoveredHour.isPeak ? ' (Peak Service Hour)' : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Busiest Days of Week */}
                  <div className="panel-box">
                    <div className="panel-header-row">
                      <div>
                        <h3 className="panel-title">Busiest Days of the Week</h3>
                        <p className="panel-sub">Volume and revenue share across weekdays vs weekends</p>
                      </div>
                    </div>

                    <div className="busiest-days-list">
                      {(() => {
                        const days = analyticsData.busiestDays || [];
                        const maxDayOrders = Math.max(...days.map(d => d.orders), 1);
                        return days.map(d => {
                          const pct = (d.orders / maxDayOrders) * 100;
                          return (
                            <div key={d.dayIndex} className="busiest-day-row">
                              <div className="busiest-day-label-group">
                                <span className="day-name">{d.name}</span>
                                <span className="day-orders-chip">{d.orders} orders</span>
                              </div>
                              <div className="busiest-day-bar-container">
                                <div className="busiest-day-bar-fill" style={{ width: `${Math.max(pct, 4)}%` }}></div>
                              </div>
                              <span className="day-revenue-val">{money(d.revenue)}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* 4. Customer Retention & Loyalty ROI (2-Col) */}
                <div className="analytics-two-col-grid">
                  {/* Customer Retention & Visit Frequency */}
                  <div className="panel-box">
                    <div className="panel-header-row">
                      <div>
                        <h3 className="panel-title">Customer Retention & Frequency</h3>
                        <p className="panel-sub">How frequently your diners return after their initial visit</p>
                      </div>
                    </div>

                    {/* First-Timer vs Repeat Diners Split Bar */}
                    <div className="retention-split-box">
                      <div className="split-labels-row">
                        <span className="split-label-text">
                          <strong className="text-blue">{analyticsData.retention.newDiners} First-Timers</strong> (
                          {100 - analyticsData.retention.repeatRate}%)
                        </span>
                        <span className="split-label-text">
                          <strong className="text-green">{analyticsData.retention.repeatDiners} Repeat Diners</strong> (
                          {analyticsData.retention.repeatRate}%)
                        </span>
                      </div>
                      <div className="retention-split-bar">
                        <div
                          className="split-segment new-segment"
                          style={{ width: `${100 - analyticsData.retention.repeatRate}%` }}
                        ></div>
                        <div
                          className="split-segment repeat-segment"
                          style={{ width: `${analyticsData.retention.repeatRate}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Frequency Tiers */}
                    <div className="frequency-tiers-list">
                      <h4 className="sub-section-heading">Visit Frequency Cohorts</h4>
                      {(analyticsData.retention.frequencyBuckets || []).map((b, i) => (
                        <div key={i} className="frequency-tier-row">
                          <div className="tier-info">
                            <span className="tier-name">{b.label}</span>
                            <span className="tier-count">{b.count} diners ({b.percentage}%)</span>
                          </div>
                          <div className="tier-bar-bg">
                            <div className="tier-bar-fill" style={{ width: `${Math.max(b.percentage, 3)}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Activity Recency Pills */}
                    <div className="recency-cohorts-box">
                      <h4 className="sub-section-heading">Diner Activity Recency</h4>
                      <div className="recency-pills-row">
                        {(analyticsData.retention.recencyBuckets || []).map((rb, idx) => (
                          <div key={idx} className="recency-pill-card">
                            <span className="recency-dot" style={{ backgroundColor: rb.color }}></span>
                            <div className="recency-text">
                              <span className="recency-count">{rb.count}</span>
                              <span className="recency-label">{rb.label}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Loyalty Program ROI */}
                  <div className="panel-box">
                    <div className="panel-header-row">
                      <div>
                        <h3 className="panel-title">Loyalty Program Health & ROI</h3>
                        <p className="panel-sub">Tangible return on investment driven by the stamp reward system</p>
                      </div>
                    </div>

                    <div className="loyalty-roi-stats-grid">
                      <div className="loyalty-stat-card bg-orange-soft">
                        <span className="loyalty-stat-label">Loyalty-Driven Revenue</span>
                        <h3 className="loyalty-stat-val text-orange">
                          {money(analyticsData.loyaltyRoi.loyaltyDrivenRevenue)}
                        </h3>
                        <small>{analyticsData.loyaltyRoi.loyaltyRevenueShare}% of total cafe sales</small>
                      </div>

                      <div className="loyalty-stat-card bg-gold-soft">
                        <span className="loyalty-stat-label">Perk Redemption Rate</span>
                        <h3 className="loyalty-stat-val text-gold">
                          {analyticsData.loyaltyRoi.redemptionRate}%
                        </h3>
                        <small>
                          {analyticsData.loyaltyRoi.totalRedeemedRewards} of{' '}
                          {analyticsData.loyaltyRoi.totalIssuedRewards} vouchers redeemed
                        </small>
                      </div>

                      <div className="loyalty-stat-card bg-purple-soft">
                        <span className="loyalty-stat-label">Active Return Vouchers</span>
                        <h3 className="loyalty-stat-val text-purple">
                          {analyticsData.loyaltyRoi.activeUnclaimedRewards}
                        </h3>
                        <small>Vouchers held by diners driving return visits</small>
                      </div>

                      <div className="loyalty-stat-card bg-blue-soft">
                        <span className="loyalty-stat-label">Discounts Provided</span>
                        <h3 className="loyalty-stat-val text-blue">
                          {money(analyticsData.loyaltyRoi.totalDiscountsGiven)}
                        </h3>
                        <small>Direct incentive rewarded to diners</small>
                      </div>
                    </div>

                    {/* ROI Summary Statement */}
                    <div className="loyalty-roi-callout">
                      <Sparkles size={20} className="text-gold" />
                      <div>
                        <strong>High Retention Multiplier:</strong> Diners who unlock stamp rewards visit{' '}
                        <strong>3.4x more often</strong> and generate over{' '}
                        <strong>{analyticsData.loyaltyRoi.loyaltyRevenueShare}%</strong> of overall café sales volume.
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Top Selling Menu Items & Category Contribution */}
                <div className="analytics-two-col-grid">
                  {/* Top Items Leaderboard */}
                  <div className="panel-box">
                    <div className="panel-header-row">
                      <div>
                        <h3 className="panel-title">Top Selling Dishes & Beverages</h3>
                        <p className="panel-sub">Ranked by order frequency and customer preference</p>
                      </div>
                    </div>

                    {(!analyticsData.topItems || analyticsData.topItems.length === 0) ? (
                      <p className="no-data-text">No order item records found for this period</p>
                    ) : (
                      <div className="top-items-leaderboard">
                        {analyticsData.topItems.map((item, idx) => (
                          <div key={idx} className="leaderboard-item-row">
                            <span className={`rank-badge ${idx < 3 ? `rank-${idx + 1}` : ''}`}>
                              #{idx + 1}
                            </span>
                            <div className="item-name-info">
                              <span className="item-name-title">{item.name}</span>
                              <span className="item-qty-sub">{item.quantity} orders sold</span>
                            </div>
                            <span className="item-revenue-tag">{money(item.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category Contribution */}
                  <div className="panel-box">
                    <div className="panel-header-row">
                      <div>
                        <h3 className="panel-title">Sales by Menu Category</h3>
                        <p className="panel-sub">Revenue share and volume contribution across food & beverages</p>
                      </div>
                    </div>

                    {(!analyticsData.categoryBreakdown || analyticsData.categoryBreakdown.length === 0) ? (
                      <p className="no-data-text">No category data available</p>
                    ) : (
                      <div className="category-breakdown-list">
                        {analyticsData.categoryBreakdown.map((cat, idx) => (
                          <div key={idx} className="category-contrib-card">
                            <div className="cat-header-row">
                              <span className="cat-name">{cat.category}</span>
                              <span className="cat-amount">{money(cat.revenue)} ({cat.share}%)</span>
                            </div>
                            <div className="cat-progress-track">
                              <div className="cat-progress-fill" style={{ width: `${Math.max(cat.share, 4)}%` }}></div>
                            </div>
                            <span className="cat-qty-foot">{cat.quantity} items served</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===================== TAB: REWARDS & REDEMPTIONS (VAULT & CASHIER TERMINAL) ===================== */}
        {tab === 'rewards' && (
          <div className="tab-pane-container" style={{ padding: '0 0 40px 0' }}>
            <div className="crm-orders-wrapper">
              {/* 1. Header Card */}
              <div className="crm-orders-header-card">
                <div className="crm-orders-header-left">
                  <div className="crm-orders-header-title-row">
                    <h2 className="crm-orders-title">Rewards Vault & Redemption Portal</h2>
                    <span className="crm-live-pill">
                      <span className="crm-pulse-dot" />
                      {data.stats?.activeRewards || 0} Claim Vouchers Ready
                    </span>
                  </div>
                  <p className="crm-orders-subtitle">
                    Validate customer claim codes or voucher passes at checkout, honor milestone discounts, and track audit trails.
                  </p>
                </div>

                <div className="crm-orders-header-actions">
                  <span className="crm-section-occupancy-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={14} />
                    <span>Counter Terminal Active</span>
                  </span>
                </div>
              </div>

              {/* 2. Key Metrics Grid */}
              <div className="crm-orders-metrics-grid">
                <div className="crm-metric-card">
                  <div className="crm-metric-icon-wrap" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                    <Gift size={20} />
                  </div>
                  <div className="crm-metric-info">
                    <span className="crm-metric-label">Active / Ready Vouchers</span>
                    <div className="crm-metric-val-row">
                      <h3 className="crm-metric-value">{data.stats?.activeRewards || 0}</h3>
                    </div>
                    <span className="crm-metric-hint" style={{ color: '#047857' }}>
                      Ready for immediate in-store claim
                    </span>
                  </div>
                </div>

                <div className="crm-metric-card">
                  <div className="crm-metric-icon-wrap" style={{ background: '#F1F7F2', color: '#176B50' }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="crm-metric-info">
                    <span className="crm-metric-label">Honored & Redeemed</span>
                    <div className="crm-metric-val-row">
                      <h3 className="crm-metric-value">{data.stats?.redeemedRewards || 0}</h3>
                    </div>
                    <span className="crm-metric-hint">Successfully discounted at billing</span>
                  </div>
                </div>

                <div className="crm-metric-card">
                  <div className="crm-metric-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
                    <Award size={20} />
                  </div>
                  <div className="crm-metric-info">
                    <span className="crm-metric-label">Default Reward Value</span>
                    <div className="crm-metric-val-row">
                      <h3 className="crm-metric-value">{money(data.cafe?.loyalty?.rewardCap || 1000)}</h3>
                    </div>
                    <span className="crm-metric-hint">Per completed visit milestone</span>
                  </div>
                </div>
              </div>

              {/* 3. In-Store Counter Cashier Terminal Box */}
              <div className="crm-floor-section-group" style={{ marginBottom: 22 }}>
                <div className="crm-floor-section-header">
                  <div className="crm-floor-section-title">
                    <ShieldCheck size={18} style={{ color: '#176B50' }} />
                    <h4>Cashier In-Store Redemption Terminal</h4>
                  </div>
                  <span className="crm-section-table-count">Instant 1-Tap Discount Verification</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#7d736b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Enter 8-Digit Customer Claim Code or Reward ID
                    </label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="e.g. CLM-9B2K4"
                        value={redeemCode}
                        onChange={e => {
                          setRedeemCode(e.target.value.toUpperCase());
                          if (verifiedReward) setVerifiedReward(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleVerifyReward();
                          }
                        }}
                        style={{
                          flex: 1,
                          minWidth: 240,
                          padding: '10px 14px',
                          border: '1.5px solid #ece4da',
                          borderRadius: 12,
                          fontFamily: 'monospace',
                          fontSize: '15px',
                          fontWeight: 700,
                          letterSpacing: '1px',
                          color: '#1a120c',
                          background: '#faf8f5',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        className="crm-btn-primary"
                        onClick={() => handleVerifyReward()}
                        disabled={verifyingCode}
                      >
                        <ShieldCheck size={15} />
                        <span>{verifyingCode ? 'Verifying…' : 'Verify Voucher'}</span>
                      </button>
                      {redeemCode && (
                        <button
                          type="button"
                          className="crm-quick-step-btn"
                          style={{ background: '#f8f5f1', color: '#1a120c', border: '1px solid #ede5db', padding: '10px 14px' }}
                          onClick={() => {
                            setRedeemCode('');
                            setVerifiedReward(null);
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Verified Voucher Outcome Card */}
                  {verifiedReward && (
                    <div
                      style={{
                        background: verifiedReward.valid ? '#f0fdf4' : '#fef2f2',
                        border: `1.5px solid ${verifiedReward.valid ? '#86efac' : '#fca5a5'}`,
                        borderRadius: 14,
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {verifiedReward.valid ? (
                            <CheckCircle2 size={24} style={{ color: '#16a34a' }} />
                          ) : (
                            <X size={24} style={{ color: '#dc2626' }} />
                          )}
                          <div>
                            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: verifiedReward.valid ? '#166534' : '#991b1b' }}>
                              {verifiedReward.valid ? 'Voucher Verified & Eligible' : 'Cannot Redeem Voucher'}
                            </h4>
                            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                              {verifiedReward.message}
                            </p>
                          </div>
                        </div>

                        {verifiedReward.valid && (
                          <span
                            className="crm-status-pill payment paid"
                            style={{ fontSize: '13px', padding: '4px 12px', fontWeight: 800 }}
                          >
                            {money(verifiedReward.reward?.amount)} DISCOUNT
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, background: '#ffffff', padding: 12, borderRadius: 10, border: '1px solid #ede5db' }}>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#8c8279', textTransform: 'uppercase', display: 'block' }}>Customer Name</span>
                          <b style={{ fontSize: '13px', color: '#1a120c' }}>{verifiedReward.reward?.customerName}</b>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#8c8279', textTransform: 'uppercase', display: 'block' }}>Mobile Number</span>
                          <b style={{ fontSize: '13px', color: '#1a120c' }}>{verifiedReward.reward?.customerPhone}</b>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#8c8279', textTransform: 'uppercase', display: 'block' }}>Claim Code</span>
                          <b style={{ fontSize: '13px', color: '#7b3d22', fontFamily: 'monospace' }}>{verifiedReward.reward?.claimCode}</b>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#8c8279', textTransform: 'uppercase', display: 'block' }}>Status</span>
                          <span className={`crm-status-pill ${verifiedReward.reward?.status === 'claimed' ? 'order-state ready' : 'payment paid'}`}>
                            {verifiedReward.reward?.status?.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {verifiedReward.valid && (
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#4b5563', marginBottom: 4 }}>
                              Bill Number / Staff Note (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Table #4, Invoice #1089"
                              value={redeemNotes}
                              onChange={e => setRedeemNotes(e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '12.5px' }}
                            />
                          </div>
                          <button
                            type="button"
                            className="crm-table-action-btn complete"
                            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: 800, flex: 'none' }}
                            onClick={() => handleRedeemReward()}
                            disabled={redeemingCode}
                          >
                            <Check size={16} strokeWidth={3} />
                            <span>{redeemingCode ? 'Processing…' : `Honor & Redeem ${money(verifiedReward.reward?.amount)} Off`}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Complete Rewards Log & Audit Trail */}
              <div className="crm-orders-toolbar-card">
                <div className="crm-orders-toolbar-left">
                  <div className="crm-orders-status-tabs">
                    {['All', 'Claimed', 'Available', 'Redeemed', 'Expired'].map(f => (
                      <button
                        key={f}
                        type="button"
                        className={`crm-status-tab-btn ${rewardFilter === f ? 'active' : ''}`}
                        onClick={() => setRewardFilter(f)}
                      >
                        <span>{f}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="crm-table-container">
                <div className="crm-table-responsive-wrapper">
                  <table className="crm-orders-table">
                    <thead>
                      <tr>
                        <th>CUSTOMER</th>
                        <th>CLAIM CODE</th>
                        <th>DISCOUNT</th>
                        <th>STATUS</th>
                        <th>CLAIMED AT</th>
                        <th>REDEEMED AT</th>
                        <th style={{ textAlign: 'right' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.rewards || [])
                        .filter(r => {
                          if (rewardFilter === 'All') return true;
                          if (rewardFilter === 'Claimed') return r.status === 'claimed';
                          if (rewardFilter === 'Available') return r.status === 'available';
                          if (rewardFilter === 'Redeemed') return r.status === 'redeemed';
                          if (rewardFilter === 'Expired') return r.status === 'expired';
                          return true;
                        })
                        .map(r => {
                          const avatar = getAvatarColor(r.customerName?.[0] || 'C');
                          return (
                            <tr key={r._id || r.id} className="crm-orders-row">
                              <td className="cell-customer">
                                <div
                                  className="crm-customer-avatar-box"
                                  style={{ background: avatar.bg, color: avatar.text }}
                                >
                                  {(r.customerName?.[0] || 'C').toUpperCase()}
                                </div>
                                <div className="crm-customer-meta">
                                  <span className="crm-customer-name">{r.customerName || 'Valued Guest'}</span>
                                  <span className="crm-customer-phone">{r.customerPhone || '—'}</span>
                                </div>
                              </td>

                              <td>
                                {r.claimCode ? (
                                  <span style={{ fontFamily: 'monospace', fontWeight: 800, background: '#f8f5f1', border: '1px solid #ede5db', padding: '3px 8px', borderRadius: 8, color: '#1a120c' }}>
                                    {r.claimCode}
                                  </span>
                                ) : (
                                  <span style={{ color: '#8c8279', fontSize: '12px' }}>Not claimed</span>
                                )}
                              </td>

                              <td>
                                <span style={{ fontWeight: 800, color: '#176B50', fontSize: '13.5px' }}>
                                  {money(r.amount)}
                                </span>
                              </td>

                              <td>
                                <span className={`crm-status-pill ${r.status === 'redeemed' ? 'payment paid' : r.status === 'claimed' ? 'order-state ready' : 'order-state placed'}`}>
                                  {r.status?.toUpperCase()}
                                </span>
                              </td>

                              <td>
                                {r.claimedAt ? (
                                  <span style={{ fontSize: '12px', color: '#7d736b' }}>
                                    {new Date(r.claimedAt).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                ) : (
                                  <span style={{ color: '#8c8279', fontSize: '12px' }}>—</span>
                                )}
                              </td>

                              <td>
                                {r.redeemedAt ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: '12px', color: '#1a120c', fontWeight: 600 }}>
                                      {new Date(r.redeemedAt).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                    {r.notes && <small style={{ color: '#8c8279', fontStyle: 'italic' }}>{r.notes}</small>}
                                    {r.redeemedBy && (
                                      <small style={{ color: '#7b3d22', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                        <User size={10} /> {r.redeemedBy}
                                      </small>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: '#8c8279', fontSize: '12px' }}>Unused</span>
                                )}
                              </td>

                              <td style={{ textAlign: 'right' }}>
                                {(r.status === 'claimed' || r.status === 'available') ? (
                                  <button
                                    type="button"
                                    className="crm-quick-step-btn ready"
                                    onClick={() => {
                                      setRedeemCode(r.claimCode || r._id || r.id);
                                      handleVerifyReward(r.claimCode || r._id || r.id);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                  >
                                    Verify & Redeem
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: 700 }}>
                                    ✓ Honored
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      {(!data.rewards || data.rewards.length === 0) && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#8c8279' }}>
                            No loyalty rewards issued yet. Rewards are created automatically when guests complete qualifying visits!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: LOYALTY & QR ===================== */}
        {tab === 'loyalty' && (
          <div className="crm-orders-wrapper" style={{ padding: '0 0 40px 0' }}>
            {/* 1. Header Card */}
            <div className="crm-orders-header-card">
              <div className="crm-orders-header-left">
                <div className="crm-orders-brand-emblem">
                  <Award size={24} style={{ color: '#DCEFE4' }} />
                </div>
                <div className="crm-orders-brand-info">
                  <div className="crm-orders-title-row">
                    <h1 className="crm-orders-title">Loyalty Program & Stamp Pass Engine</h1>
                    <span className="crm-menu-status-badge">
                      <span className="crm-pulse-dot" />
                      Active Customer Retention
                    </span>
                  </div>
                  <p className="crm-orders-subtitle">
                    Configure visit milestones, qualifying spend threshold, reward discount vouchers and table QR touchpoints
                  </p>
                </div>
              </div>

              <div className="crm-orders-header-actions">
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => setTab('rewards')}
                >
                  <Gift size={16} />
                  <span>Redemption Counter</span>
                </button>
                <button
                  type="button"
                  className="crm-btn-primary"
                  onClick={() => setTab('qr-kit')}
                >
                  <QrCode size={16} />
                  <span>Print Table Standees</span>
                </button>
              </div>
            </div>

            {/* 2. KPI Summary */}
            <div className="crm-orders-metrics-grid" style={{ marginBottom: '20px' }}>
              <div className="crm-metric-card">
                <div className="crm-metric-icon-box" style={{ background: '#F1F7F2', color: '#176B50' }}>
                  <Award size={20} />
                </div>
                <div className="crm-metric-content">
                  <span className="crm-metric-label">Stamp Unlock Threshold</span>
                  <div className="crm-metric-value">{data?.cafe?.loyalty?.visitsRequired || 8} <small style={{ fontSize: '13px', fontWeight: 500, color: '#8c8279' }}>Visits</small></div>
                  <span className="crm-metric-hint">Diners unlock reward voucher</span>
                </div>
              </div>

              <div className="crm-metric-card">
                <div className="crm-metric-icon-box" style={{ background: '#fef9ee', color: '#d97706' }}>
                  <Coins size={20} />
                </div>
                <div className="crm-metric-content">
                  <span className="crm-metric-label">Min. Qualifying Spend</span>
                  <div className="crm-metric-value">₹{data?.cafe?.loyalty?.minimumSpend || 300}</div>
                  <span className="crm-metric-hint">Per visit to stamp digital pass</span>
                </div>
              </div>

              <div className="crm-metric-card">
                <div className="crm-metric-icon-box" style={{ background: '#fcf5eb', color: '#7b3d22' }}>
                  <Gift size={20} />
                </div>
                <div className="crm-metric-content">
                  <span className="crm-metric-label">Reward Voucher Cap</span>
                  <div className="crm-metric-value">₹{data?.cafe?.loyalty?.rewardCap || 1000}</div>
                  <span className="crm-metric-hint">Discount applied on counter checkout</span>
                </div>
              </div>

              <div className="crm-metric-card">
                <div className="crm-metric-icon-box" style={{ background: '#faf3ea', color: '#92400e' }}>
                  <Clock size={20} />
                </div>
                <div className="crm-metric-content">
                  <span className="crm-metric-label">Voucher Validity</span>
                  <div className="crm-metric-value">{data?.cafe?.loyalty?.validityDays || 60} <small style={{ fontSize: '13px', fontWeight: 500, color: '#8c8279' }}>Days</small></div>
                  <span className="crm-metric-hint">Auto-expires after unlocking</span>
                </div>
              </div>
            </div>

            {/* 3. Main Split View Grid: Left Rules Form, Right Live Digital Pass & QR Touchpoint */}
            <div className="split-view-grid">
              <div className="panel-box">
                <div className="panel-header-row">
                  <div>
                    <h3 className="panel-title">Loyalty Program Engine Rules</h3>
                    <p className="panel-sub">Fine-tune milestone requirements and reward caps for your café</p>
                  </div>
                </div>

                <form className="theme-form-grid" onSubmit={saveLoyalty}>
                  {[
                    ['visitsRequired', 'Visits Required to Unlock Reward', '8', 'Number of stamped visits needed to earn a discount voucher'],
                    ['minimumSpend', 'Minimum Qualifying Spend (INR)', '300', 'Minimum bill amount to earn 1 loyalty stamp per visit'],
                    ['rewardCap', 'Reward Discount Amount (INR)', '1000', 'Maximum voucher discount applied when diner redeems'],
                    ['validityDays', 'Reward Expiry Window (Days)', '60', 'Days diner has to claim reward before voucher expires']
                  ].map(([k, labelText, defVal, hintText]) => (
                    <label key={k} className="full-width">
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1a120c' }}>{labelText}</span>
                      <input
                        type="number"
                        value={data?.cafe?.loyalty?.[k] ?? defVal}
                        onChange={e =>
                          setData({
                            ...data,
                            cafe: {
                              ...data.cafe,
                              loyalty: { ...data.cafe.loyalty, [k]: Number(e.target.value) }
                            }
                          })
                        }
                        style={{ border: '1px solid #ece4da', borderRadius: '10px', padding: '11px 14px', fontSize: '14px', color: '#1a120c' }}
                      />
                      <small style={{ fontSize: '11px', color: '#8c8279', marginTop: '2px' }}>{hintText}</small>
                    </label>
                  ))}

                  <button className="crm-btn-primary full-width" type="submit" style={{ marginTop: '8px' }}>
                    <Check size={16} />
                    <span>Save Loyalty Rules</span>
                  </button>
                </form>
              </div>

              {/* Right: Live Digital Stamp Card & Table Pass */}
              <div className="panel-box" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="panel-header-row" style={{ marginBottom: 0 }}>
                  <div>
                    <h3 className="panel-title">Live Digital Pass Preview</h3>
                    <p className="panel-sub">How guests view their stamp progress on mobile</p>
                  </div>
                  <span className="crm-status-pill order-preparing" style={{ fontSize: '10px' }}>Diner View</span>
                </div>

                {/* Digital Stamp Pass Preview Mockup */}
                <div style={{
                  background: 'linear-gradient(135deg, #1a120c 0%, #241b14 100%)',
                  borderRadius: '16px',
                  padding: '20px',
                  color: '#ffffff',
                  boxShadow: '0 8px 24px rgba(26, 18, 12, 0.25)',
                  border: '1px solid #362519',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(23, 107, 80,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Coffee size={18} style={{ color: '#176B50' }} />
                      <strong style={{ fontSize: '14px', letterSpacing: '0.02em', color: '#F1F7F2' }}>{data?.cafe?.name || 'Gusstora Roastery'}</strong>
                    </div>
                    <span style={{ fontSize: '10.5px', background: 'rgba(23, 107, 80, 0.2)', border: '1px solid rgba(23, 107, 80, 0.4)', color: '#176B50', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>VIP CLUB</span>
                  </div>

                  {/* Stamp Grid Mockup (Visits Required) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', margin: '14px 0' }}>
                    {Array.from({ length: Math.min(8, data?.cafe?.loyalty?.visitsRequired || 8) }).map((_, idx) => (
                      <div
                        key={idx}
                        style={{
                          height: '46px',
                          borderRadius: '10px',
                          background: idx < 5 ? 'rgba(23, 107, 80, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                          border: idx < 5 ? '1px solid #176B50' : '1px dashed rgba(255, 255, 255, 0.15)',
                          display: 'grid',
                          placeItems: 'center',
                          color: idx < 5 ? '#176B50' : 'rgba(255, 255, 255, 0.3)',
                          fontSize: '12px',
                          fontWeight: 700
                        }}
                      >
                        {idx < 5 ? <Coffee size={18} /> : <span>{idx + 1}</span>}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#c9bea3', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                    <span>5 / {data?.cafe?.loyalty?.visitsRequired || 8} stamps earned</span>
                    <span style={{ color: '#176B50', fontWeight: 700 }}>Unlock ₹{data?.cafe?.loyalty?.rewardCap || 1000} Voucher</span>
                  </div>
                </div>

                {/* Table Standee QR Code Touchpoint */}
                <div style={{ background: '#fcf9f6', border: '1px solid #ece4da', borderRadius: '14px', padding: '18px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-block', background: '#ffffff', padding: '12px', borderRadius: '12px', border: '1px solid #ece4da', boxShadow: '0 4px 12px rgba(26,18,12,0.04)' }}>
                    <QRCodeSVG value={url} size={160} bgColor="#ffffff" fgColor="#1a120c" />
                  </div>
                  <h4 style={{ margin: '12px 0 4px', fontSize: '14px', fontWeight: 700, color: '#1a120c' }}>Dine-In Digital Menu & Self-Order QR</h4>
                  <p style={{ margin: '0 0 14px', fontSize: '11.5px', color: '#675b52' }}>Scan with any mobile camera to test diner ordering flow.</p>
                  
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <a href={url} target="_blank" rel="noreferrer" className="crm-btn-secondary" style={{ textDecoration: 'none' }}>
                      <span>Open Customer View</span>
                      <ExternalLink size={13} />
                    </a>
                    <button type="button" className="crm-btn-primary" onClick={() => setTab('qr-kit')}>
                      <QrCode size={14} />
                      <span>Standee Kit</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: SETTINGS ===================== */}
        {tab === 'settings' && (
          <div className="crm-orders-wrapper" style={{ padding: '0 0 40px 0' }}>
            {/* 1. Header Card */}
            <div className="crm-orders-header-card">
              <div className="crm-orders-header-left">
                <div className="crm-orders-brand-emblem">
                  <Sliders size={24} style={{ color: '#DCEFE4' }} />
                </div>
                <div className="crm-orders-brand-info">
                  <div className="crm-orders-title-row">
                    <h1 className="crm-orders-title">Café Profile & Establishment Settings</h1>
                    <span className="crm-menu-status-badge">
                      <span className="crm-pulse-dot" />
                      Live Venue Profile
                    </span>
                  </div>
                  <p className="crm-orders-subtitle">
                    Manage venue contact information, table count, Wi-Fi credentials, Google Review links and brand accents
                  </p>
                </div>
              </div>

              <div className="crm-orders-header-actions">
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => setTab('overview')}
                >
                  <Home size={16} />
                  <span>Overview Pulse</span>
                </button>
              </div>
            </div>

            {/* 2. Main Form Panel Box */}
            <div className="panel-box max-w-720" style={{ margin: '0 auto', width: '100%' }}>
              <div className="panel-header-row">
                <div>
                  <h3 className="panel-title">Venue Profile & Touchpoint Parameters</h3>
                  <p className="panel-sub">Details are automatically synced across diner menus and printed QR standees</p>
                </div>
              </div>

              <form className="theme-form-grid" onSubmit={saveCafeSettings}>
                {/* Section 1: Identity */}
                <div style={{ gridColumn: '1 / -1', paddingBottom: '8px', borderBottom: '1px solid #f0e9e1', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#176B50' }}>
                    1. ESTABLISHMENT IDENTITY & LOCATION
                  </span>
                </div>

                <label>
                  <span>Café Name</span>
                  <input
                    value={data.cafe.name}
                    onChange={e => setData({ ...data, cafe: { ...data.cafe, name: e.target.value } })}
                  />
                </label>

                <label>
                  <span>Phone Number</span>
                  <input
                    value={data.cafe.phone}
                    onChange={e => setData({ ...data, cafe: { ...data.cafe, phone: e.target.value } })}
                  />
                </label>

                <label className="full-width">
                  <span>Address</span>
                  <input
                    value={data.cafe.address}
                    onChange={e => setData({ ...data, cafe: { ...data.cafe, address: e.target.value } })}
                  />
                </label>

                <label>
                  <span>Total Physical Tables</span>
                  <input
                    type="number"
                    value={data.cafe.tables}
                    onChange={e => setData({ ...data, cafe: { ...data.cafe, tables: e.target.value } })}
                  />
                </label>

                <label className="full-width">
                  <span>Welcome Tagline</span>
                  <input
                    type="text"
                    placeholder="e.g. Specialty Roastery & Wood-Fired Pastries"
                    value={data.cafe.tagline || ''}
                    onChange={e => setData({ ...data, cafe: { ...data.cafe, tagline: e.target.value } })}
                  />
                  <small style={{ fontSize: '11px', color: '#8c8279', marginTop: '2px' }}>
                    Displayed on your diner ordering header and printed on QR table standees
                  </small>
                </label>

                {/* Section 2: Wi-Fi */}
                <div style={{ gridColumn: '1 / -1', paddingBottom: '8px', borderBottom: '1px solid #f0e9e1', marginTop: '14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#176B50' }}>
                    2. GUEST WI-FI CONNECTIVITY (TABLE DISPLAY)
                  </span>
                </div>

                <label>
                  <span>Guest Wi-Fi Network (SSID)</span>
                  <input
                    type="text"
                    placeholder="e.g. Cafe_Guest_Wi-Fi"
                    value={data.cafe.wifiSsid || ''}
                    onChange={e => setData({ ...data, cafe: { ...data.cafe, wifiSsid: e.target.value } })}
                  />
                </label>

                <label>
                  <span>Guest Wi-Fi Password</span>
                  <input
                    type="text"
                    placeholder="e.g. coffee2026"
                    value={data.cafe.wifiPassword || ''}
                    onChange={e => setData({ ...data, cafe: { ...data.cafe, wifiPassword: e.target.value } })}
                  />
                </label>

                {/* Section 3: Digital Links */}
                <div style={{ gridColumn: '1 / -1', paddingBottom: '8px', borderBottom: '1px solid #f0e9e1', marginTop: '14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#176B50' }}>
                    3. DIGITAL REPUTATION & SOCIAL PRESENCE
                  </span>
                </div>

                <label className="full-width">
                  <span>Google Review Destination URL</span>
                  <input
                    type="url"
                    placeholder="https://g.page/r/.../review"
                    value={data.cafe.googleReviewUrl || ''}
                    onChange={e => setData({ ...data, cafe: { ...data.cafe, googleReviewUrl: e.target.value } })}
                  />
                  <small style={{ fontSize: '11px', color: '#8c8279', marginTop: '2px' }}>
                    Direct link where guests are taken when clicking "Write Google Review"
                  </small>
                </label>

                <label className="full-width">
                  <span>Instagram Profile URL</span>
                  <input
                    type="url"
                    placeholder="https://instagram.com/yourcafe"
                    value={data.cafe.instagramUrl || ''}
                    onChange={e => setData({ ...data, cafe: { ...data.cafe, instagramUrl: e.target.value } })}
                  />
                  <small style={{ fontSize: '11px', color: '#8c8279', marginTop: '2px' }}>
                    Social handle or page opened when guests click "Follow on Instagram"
                  </small>
                </label>

                {/* Section 4: Brand Accent */}
                <div style={{ gridColumn: '1 / -1', paddingBottom: '8px', borderBottom: '1px solid #f0e9e1', marginTop: '14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#176B50' }}>
                    4. BRAND ACCENT PALETTE
                  </span>
                </div>

                <label className="full-width">
                  <span>Brand Accent Color</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <input
                      type="color"
                      value={data.cafe.brandColor || '#176B50'}
                      onChange={e => setData({ ...data, cafe: { ...data.cafe, brandColor: e.target.value } })}
                      style={{ width: '42px', height: '38px', padding: '0', border: '1px solid #ece4da', borderRadius: '8px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={data.cafe.brandColor || '#176B50'}
                      onChange={e => setData({ ...data, cafe: { ...data.cafe, brandColor: e.target.value } })}
                      style={{ flex: 1 }}
                    />
                  </div>
                  {/* Preset Coffee Palette Chips */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    {[
                      { name: 'Emerald Forest', hex: '#176B50' },
                      { name: 'Cognac Roast', hex: '#7b3d22' },
                      { name: 'Dark Roast', hex: '#241b14' },
                      { name: 'Espresso', hex: '#1a120c' }
                    ].map(preset => (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setData({ ...data, cafe: { ...data.cafe, brandColor: preset.hex } })}
                        style={{
                          background: '#fcf9f6',
                          border: data.cafe.brandColor === preset.hex ? '2px solid #176B50' : '1px solid #ece4da',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#1a120c'
                        }}
                      >
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: preset.hex, display: 'inline-block' }} />
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </label>

                {/* Section 5: Customer Facing Display (CFD) Controls */}
                <div style={{ gridColumn: '1 / -1', paddingBottom: '8px', borderBottom: '1px solid #f0e9e1', marginTop: '14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#176B50' }}>
                    5. DUAL-SCREEN CUSTOMER FACING DISPLAY (CFD) SETTINGS
                  </span>
                </div>

                <label>
                  <span>CFD Welcome Title</span>
                  <input
                    type="text"
                    placeholder="Welcome to Gusstora"
                    value={data.cafe.cfdWelcomeTitle || ''}
                    onChange={e => setData({ ...data, cafe: { ...data.cafe, cfdWelcomeTitle: e.target.value } })}
                  />
                </label>

                <label>
                  <span>CFD Welcome Subtitle / Roastery Tagline</span>
                  <input
                    type="text"
                    placeholder="Artisan Coffee & Wood-Fired Pastries"
                    value={data.cafe.cfdWelcomeSubtitle || ''}
                    onChange={e => setData({ ...data, cafe: { ...data.cafe, cfdWelcomeSubtitle: e.target.value } })}
                  />
                </label>

                <label className="full-width">
                  <span>CFD Announcement & Promotional Banner</span>
                  <input
                    type="text"
                    placeholder="Happy Hour: 20% off all manual pour-overs 3PM - 6PM!"
                    value={data.cafe.cfdPromoBanner || ''}
                    onChange={e => setData({ ...data, cafe: { ...data.cafe, cfdPromoBanner: e.target.value } })}
                  />
                </label>

                <label className="full-width">
                  <span>Store UPI ID / VPA for Dynamic QR Payments</span>
                  <input
                    type="text"
                    placeholder="roastery@okhdfcbank"
                    value={data.cafe.cfdUpiVpa || ''}
                    onChange={e => setData({ ...data, cafe: { ...data.cafe, cfdUpiVpa: e.target.value } })}
                  />
                  <small style={{ fontSize: '11px', color: '#8c8279', marginTop: '2px' }}>
                    Used by the Customer Facing Display to generate dynamic, amount-coded UPI QR codes for zero-contact customer checkout.
                  </small>
                </label>

                <button className="crm-btn-primary full-width" type="submit" style={{ marginTop: '12px', padding: '14px' }}>
                  <Check size={16} />
                  <span>Save Café, Social & CFD Settings</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ===================== TAB: STAFF & ROLES (RBAC) ===================== */}
        {tab === 'staff' && (isOwner || isManager) && (
          <div className="crm-orders-wrapper" style={{ padding: '0 0 40px 0' }}>
            {/* 1. Header Hero Card */}
            <div className="crm-orders-header-card">
              <div className="crm-orders-header-left">
                <div className="crm-orders-brand-emblem">
                  <Users size={24} style={{ color: '#DCEFE4' }} />
                </div>
                <div className="crm-orders-brand-info">
                  <div className="crm-orders-title-row">
                    <h2 className="crm-orders-title">Staff Registry & Team Permissions</h2>
                    <span className="crm-orders-live-badge">
                      <span className="crm-orders-live-pulse"></span>
                      ACTIVE ROSTER
                    </span>
                  </div>
                  <p className="crm-orders-subtitle">
                    Manage active team member accounts, duty credentials, and Role-Based Access Control (RBAC) across floor, kitchen, and management
                  </p>
                </div>
              </div>

              <div className="crm-orders-header-actions">
                <button className="crm-btn-secondary" onClick={fetchStaff} disabled={loadingStaff} type="button">
                  <RefreshCw size={14} className={loadingStaff ? 'loader-logo-spin' : ''} />
                  <span>Sync Roster</span>
                </button>
                <button
                  className="crm-btn-primary"
                  type="button"
                  onClick={() => {
                    setStaffForm({ name: '', email: '', phone: '', password: '', role: 'cashier' });
                    setShowAddStaffModal(true);
                  }}
                >
                  <UserPlus size={15} />
                  <span>Add Team Member</span>
                </button>
              </div>
            </div>

            {/* 2. Top KPI Summary Grid */}
            <div className="crm-orders-metrics-grid">
              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap cognac">
                  <Users size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Total Team Members</span>
                  <div className="crm-stat-value">{staffList.length}</div>
                </div>
                <span className="crm-stat-tag neutral">Full Roster</span>
              </div>

              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap green">
                  <UserCheck size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Active on Duty</span>
                  <div className="crm-stat-value">{staffList.filter(s => s.status === 'active').length}</div>
                </div>
                <span className="crm-stat-tag ready">Authenticated</span>
              </div>

              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap espresso">
                  <ShieldCheck size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Management Sovereignty</span>
                  <div className="crm-stat-value">{staffList.filter(s => s.role === 'owner' || s.role === 'manager').length}</div>
                </div>
                <span className="crm-stat-tag warm">Owners & Leads</span>
              </div>

              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap orange">
                  <ChefHat size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Front & Kitchen Crew</span>
                  <div className="crm-stat-value">{staffList.filter(s => s.role === 'cashier' || s.role === 'kitchen').length}</div>
                </div>
                <span className="crm-stat-tag cooking">Floor & Line</span>
              </div>
            </div>

            {/* 3. Role Permissions Matrix Preview Box */}
            <div className="roles-matrix-box">
              <div className="roles-matrix-title-row">
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-dark, #1e1611)' }}>
                    Role-Based Access Control (RBAC) Hierarchy
                  </h4>
                  <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--text-muted, #7d736b)' }}>
                    System operational privileges and actions are automatically scoped to each team member's role
                  </p>
                </div>
                <span className="role-badge owner" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Lock size={12} />
                  <span>SECURE PROTOCOL</span>
                </span>
              </div>

              <div className="roles-matrix-grid">
                <div className="role-scope-card">
                  <div className="role-scope-header">
                    <span className="role-badge owner" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Crown size={12} /> OWNER
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#7b3d22' }}>Root Sovereign</span>
                  </div>
                  <p className="role-scope-desc">
                    Full Sovereignty. Venue profile & branding, billing, loyalty rules, staff creation & deletion.
                  </p>
                  <div className="role-scope-features">
                    <span className="feature-tag">All Features</span>
                    <span className="feature-tag">Staff Admin</span>
                    <span className="feature-tag">Café Settings</span>
                  </div>
                </div>

                <div className="role-scope-card">
                  <div className="role-scope-header">
                    <span className="role-badge manager" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <ClipboardList size={12} /> MANAGER
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#176B50' }}>Operations</span>
                  </div>
                  <p className="role-scope-desc">
                    Operational management. Menu catalog, dining queue, customer CRM, staff invites (excluding owner accounts).
                  </p>
                  <div className="role-scope-features">
                    <span className="feature-tag">Menu</span>
                    <span className="feature-tag">Orders</span>
                    <span className="feature-tag">Bookings</span>
                    <span className="feature-tag">CRM</span>
                    <span className="feature-tag">Team</span>
                  </div>
                </div>

                <div className="role-scope-card">
                  <div className="role-scope-header">
                    <span className="role-badge cashier" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <CreditCard size={12} /> CASHIER
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#047857' }}>Front-of-House</span>
                  </div>
                  <p className="role-scope-desc">
                    Floor checkout & counter service. Live order intake, payment reconciliation, reward voucher verification.
                  </p>
                  <div className="role-scope-features">
                    <span className="feature-tag">POS Queue</span>
                    <span className="feature-tag">Bookings</span>
                    <span className="feature-tag">Diner CRM</span>
                    <span className="feature-tag">Redeem Vouchers</span>
                  </div>
                </div>

                <div className="role-scope-card">
                  <div className="role-scope-header">
                    <span className="role-badge kitchen" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <ChefHat size={12} /> KITCHEN
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#16A579' }}>Back-of-House</span>
                  </div>
                  <p className="role-scope-desc">
                    Kitchen Display System (KDS). Real-time ticket board, item prep checklists, cooking to served lifecycle.
                  </p>
                  <div className="role-scope-features">
                    <span className="feature-tag">KDS Board</span>
                    <span className="feature-tag">Cooking Queue</span>
                    <span className="feature-tag">Stage Controls</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Staff Toolbar & Filter Strip */}
            <div className="crm-orders-toolbar-card">
              <div className="crm-orders-toolbar-left">
                <div className="crm-orders-search-box">
                  <Search size={15} className="crm-search-icon" />
                  <input
                    type="text"
                    placeholder="Search staff by name, email, or phone…"
                    value={staffSearch}
                    onChange={e => setStaffSearch(e.target.value)}
                    className="crm-orders-search-input"
                  />
                  {staffSearch && (
                    <button type="button" className="crm-search-clear-btn" onClick={() => setStaffSearch('')}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="crm-orders-toolbar-right" style={{ display: 'flex', gap: '10px' }}>
                <select
                  className="crm-table-select"
                  value={staffRoleFilter}
                  onChange={e => setStaffRoleFilter(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: '1px solid #ece4da',
                    background: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    color: '#1a120c'
                  }}
                >
                  <option value="all">All Roles</option>
                  <option value="owner">Owner</option>
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="kitchen">Kitchen</option>
                </select>

                <select
                  className="crm-table-select"
                  value={staffStatusFilter}
                  onChange={e => setStaffStatusFilter(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: '1px solid #ece4da',
                    background: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    color: '#1a120c'
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* 5. Staff Table */}
            <div className="crm-table-container">
              <div className="crm-table-responsive-wrapper">
                <table className="crm-orders-table">
                  <thead>
                    <tr>
                      <th>TEAM MEMBER</th>
                      <th>ROLE</th>
                      <th>CONTACT</th>
                      <th>STATUS</th>
                      <th>JOINED</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map(member => {
                      const avatarColors = getAvatarColor(member.name?.[0] || 'S');
                      const isSelf = member._id === data.user?._id || member.id === data.user?.id;
                      const isMemberOwner = member.role === 'owner';
                      const canModify = isOwner || (!isMemberOwner && isManager);

                      return (
                        <tr key={member._id || member.id} className="crm-orders-row">
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div
                                className="staff-table-avatar"
                                style={{
                                  backgroundColor: avatarColors.bg,
                                  color: avatarColors.text,
                                }}
                              >
                                {(member.name?.[0] || 'S').toUpperCase()}
                              </div>
                              <div>
                                <b style={{ display: 'block', fontSize: '13.5px', color: 'var(--text-dark, #1e1611)' }}>
                                  {member.name} {isSelf && <span style={{ fontSize: '11px', color: '#176B50', fontWeight: '700' }}>(You)</span>}
                                </b>
                                <small style={{ color: 'var(--text-muted, #7d736b)', fontSize: '12px' }}>{member.email}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${member.role}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              {member.role === 'owner' ? <><Crown size={12} /> OWNER</> : member.role === 'manager' ? <><ClipboardList size={12} /> MANAGER</> : member.role === 'cashier' ? <><CreditCard size={12} /> CASHIER</> : <><ChefHat size={12} /> KITCHEN</>}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '12.5px', color: '#334155' }}>
                              {member.phone ? (
                                <a href={`tel:${member.phone}`} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <Phone size={12} style={{ color: '#176B50' }} /> {member.phone}
                                </a>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`crm-stat-tag ${member.status === 'active' ? 'ready' : 'neutral'}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: member.status === 'active' ? '#047857' : '#9ca3af' }}></span>
                              <span>{member.status?.toUpperCase() || 'ACTIVE'}</span>
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '12.5px', color: 'var(--text-muted, #7d736b)' }}>
                              {member.createdAt ? new Date(member.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}
                            </span>
                          </td>
                          <td>
                            <div className="staff-action-btns" style={{ justifyContent: 'flex-end' }}>
                              {/* Toggle Active / Inactive */}
                              {!isSelf && canModify && (
                                <button
                                  type="button"
                                  className="staff-action-btn"
                                  title={member.status === 'active' ? 'Deactivate account' : 'Activate account'}
                                  onClick={() => handleToggleStaffStatus(member)}
                                >
                                  <Power size={13} style={{ color: member.status === 'active' ? '#E66B67' : '#16A579' }} />
                                  <span>{member.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                                </button>
                              )}

                              {/* Edit details */}
                              {canModify && (
                                <button
                                  type="button"
                                  className="staff-action-btn"
                                  onClick={() => setEditingStaff({ ...member, newPassword: '' })}
                                >
                                  <Pencil size={13} />
                                  <span>Edit</span>
                                </button>
                              )}

                              {/* Delete (Owner only) */}
                              {isOwner && !isSelf && (
                                <button
                                  type="button"
                                  className="staff-action-btn delete"
                                  onClick={() => handleDeleteStaff(member)}
                                  title="Delete staff account"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStaff.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                          No team members found matching your search or filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: REMINDERS & AUTOMATION ===================== */}
        {tab === 'reminders' && (isOwner || isManager) && (
          <div className="crm-orders-wrapper" style={{ padding: '0 0 40px 0' }}>
            {/* 1. Header Hero Card */}
            <div className="crm-orders-header-card">
              <div className="crm-orders-header-left">
                <div className="crm-orders-brand-emblem">
                  <Sliders size={24} style={{ color: '#DCEFE4' }} />
                </div>
                <div className="crm-orders-brand-info">
                  <div className="crm-orders-title-row">
                    <h2 className="crm-orders-title">Automated Reminders & Retention Engine</h2>
                    <span className="crm-orders-live-badge">
                      <span className="crm-orders-live-pulse"></span>
                      WHATSAPP DISPATCH READY
                    </span>
                  </div>
                  <p className="crm-orders-subtitle">
                    Re-engage lapsed diners, nudge near-reward guests, and alert customers before vouchers expire via personalized WhatsApp messages
                  </p>
                </div>
              </div>

              <div className="crm-orders-header-actions">
                <button
                  className="crm-btn-secondary"
                  onClick={fetchReminders}
                  disabled={loadingReminders}
                  title="Refresh audience and metrics"
                  type="button"
                >
                  <RefreshCw size={14} className={loadingReminders ? 'loader-logo-spin' : ''} />
                  <span>{loadingReminders ? 'Scanning…' : 'Sync Engine'}</span>
                </button>
                <button
                  className="crm-btn-secondary"
                  onClick={handleRunBatch}
                  disabled={runningBatch}
                  title="Scan audience and dispatch ready notifications"
                  type="button"
                >
                  <Zap size={14} />
                  <span>{runningBatch ? 'Processing…' : 'Run Auto Scan'}</span>
                </button>
                <button
                  className="crm-btn-primary"
                  onClick={handleOpenCreateRuleModal}
                  type="button"
                >
                  <Plus size={15} />
                  <span>Create Trigger Rule</span>
                </button>
              </div>
            </div>

            {/* 2. Top KPI Summary Grid */}
            <div className="crm-orders-metrics-grid">
              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap cognac">
                  <Sliders size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Active Automation Rules</span>
                  <div className="crm-stat-value">
                    {reminderSummary?.activeRules ?? reminderRules.filter(r => r.enabled).length}
                  </div>
                </div>
                <span className="crm-stat-tag warm">Running</span>
              </div>

              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap green">
                  <Users size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Audience Candidates Ready</span>
                  <div className="crm-stat-value">
                    {reminderAudience?.stats?.ready ?? 0}
                  </div>
                </div>
                <span className="crm-stat-tag ready">Actionable</span>
              </div>

              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap orange">
                  <ShieldCheck size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Anti-Spam Cooldown</span>
                  <div className="crm-stat-value">
                    {reminderAudience?.stats?.inCooldown ?? 0}
                  </div>
                </div>
                <span className="crm-stat-tag neutral">Protected</span>
              </div>

              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap espresso">
                  <Send size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Total Delivered Lifetime</span>
                  <div className="crm-stat-value">
                    {reminderSummary?.totalSent ?? reminderLogs.length}
                  </div>
                </div>
                <span className="crm-stat-tag warm">Audit Trail</span>
              </div>
            </div>

            {/* 3. Sub-Tab Navigation Bar */}
            <div className="crm-subnav-bar">
              <button
                type="button"
                className={`crm-subnav-btn ${reminderSubTab === 'audience' ? 'active' : ''}`}
                onClick={() => setReminderSubTab('audience')}
              >
                <Users size={15} />
                <span>Audience Candidates ({filteredReminderCandidates.length})</span>
              </button>
              <button
                type="button"
                className={`crm-subnav-btn ${reminderSubTab === 'rules' ? 'active' : ''}`}
                onClick={() => setReminderSubTab('rules')}
              >
                <Sliders size={15} />
                <span>Automation Rules ({reminderRules.length})</span>
              </button>
              <button
                type="button"
                className={`crm-subnav-btn ${reminderSubTab === 'logs' ? 'active' : ''}`}
                onClick={() => setReminderSubTab('logs')}
              >
                <History size={15} />
                <span>Delivery Audit History ({reminderLogs.length})</span>
              </button>
            </div>

            {/* ================= SUB-TAB 1: AUDIENCE STREAM ================= */}
            {reminderSubTab === 'audience' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Filters Row */}
                <div className="crm-orders-toolbar-card">
                  <div className="crm-orders-toolbar-left">
                    <div className="crm-orders-search-box">
                      <Search size={15} className="crm-search-icon" />
                      <input
                        type="text"
                        placeholder="Search matching diners by name, phone or rule…"
                        value={reminderAudienceSearch}
                        onChange={e => setReminderAudienceSearch(e.target.value)}
                        className="crm-orders-search-input"
                      />
                      {reminderAudienceSearch && (
                        <button type="button" className="crm-search-clear-btn" onClick={() => setReminderAudienceSearch('')}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="crm-orders-toolbar-right" style={{ display: 'flex', gap: '10px' }}>
                    <select
                      className="crm-table-select"
                      value={reminderTriggerFilter}
                      onChange={e => setReminderTriggerFilter(e.target.value)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '10px',
                        border: '1px solid #ece4da',
                        background: '#ffffff',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        color: '#1a120c'
                      }}
                    >
                      <option value="all">All Triggers</option>
                      <option value="near_reward">Near Reward</option>
                      <option value="inactive_days">Lapsed Diner</option>
                      <option value="expiring_reward">Expiring Voucher</option>
                      <option value="first_visit">Welcome Follow-up</option>
                    </select>

                    <select
                      className="crm-table-select"
                      value={reminderStatusFilter}
                      onChange={e => setReminderStatusFilter(e.target.value)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '10px',
                        border: '1px solid #ece4da',
                        background: '#ffffff',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        color: '#1a120c'
                      }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="ready">Ready to Send</option>
                      <option value="cooldown">In Cooldown</option>
                    </select>
                  </div>
                </div>

                {/* Audience Candidates Table */}
                <div className="crm-table-container">
                  <div className="crm-table-responsive-wrapper">
                    <table className="crm-orders-table">
                      <thead>
                        <tr>
                          <th>DINER</th>
                          <th>TRIGGER MATCH</th>
                          <th>LOYALTY STATUS</th>
                          <th>ANTI-SPAM GATE</th>
                          <th style={{ textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReminderCandidates.map(cand => {
                          const avatarColors = getAvatarColor(cand.customerName?.[0] || 'D');
                          const isSending = sendingCandidateId === (cand.candidateId || cand.customerId);

                          return (
                            <tr key={cand.candidateId || cand.customerId} className="crm-orders-row">
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div
                                    className="staff-table-avatar"
                                    style={{
                                      backgroundColor: avatarColors.bg,
                                      color: avatarColors.text,
                                    }}
                                  >
                                    {(cand.customerName?.[0] || 'D').toUpperCase()}
                                  </div>
                                  <div>
                                    <b style={{ display: 'block', fontSize: '13.5px', color: 'var(--text-dark, #1e1611)' }}>
                                      {cand.customerName}
                                    </b>
                                    <small style={{ color: 'var(--text-muted, #7d736b)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <Phone size={11} style={{ color: '#176B50' }} /> {cand.customerPhone}
                                    </small>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <div>
                                  <span className={`role-badge ${cand.triggerType === 'near_reward' ? 'owner' : cand.triggerType === 'expiring_reward' ? 'manager' : cand.triggerType === 'first_visit' ? 'cashier' : 'kitchen'}`}>
                                    {cand.ruleName}
                                  </span>
                                  <div style={{ fontSize: '11.5px', color: 'var(--text-subtle, #7d736b)', marginTop: '4px' }}>
                                    {cand.reason}
                                  </div>
                                </div>
                              </td>

                              <td>
                                <div style={{ fontSize: '12.5px' }}>
                                  <b>{cand.visits || 0} visits recorded</b>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginTop: '2px' }}>
                                    {cand.stampsLeft === 1
                                      ? '1 stamp to free reward'
                                      : `${cand.stampsLeft} stamps remaining`}
                                  </div>
                                </div>
                              </td>

                              <td>
                                {cand.inCooldown ? (
                                  <span
                                    className="crm-stat-tag warm"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                    title={`Spam Protection: Customer contacted ${cand.daysSinceLastNotice}d ago. In cooldown.`}
                                  >
                                    <AlertCircle size={12} />
                                    <span>In Cooldown ({cand.daysSinceLastNotice}d ago)</span>
                                  </span>
                                ) : (
                                  <span
                                    className="crm-stat-tag ready"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                  >
                                    <CheckCircle2 size={12} />
                                    <span>Ready to Send</span>
                                  </span>
                                )}
                              </td>

                              <td>
                                <div className="staff-action-btns" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                                  <button
                                    type="button"
                                    className="crm-btn-whatsapp"
                                    onClick={() => handleDispatchSingle(cand)}
                                    disabled={isSending || cand.inCooldown}
                                    title={cand.inCooldown ? 'Customer in cooldown. Use Preview to override.' : 'Send WhatsApp message'}
                                    style={{ opacity: cand.inCooldown ? 0.45 : 1 }}
                                  >
                                    <Send size={13} />
                                    <span>{isSending ? 'Sending…' : 'WhatsApp'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="staff-action-btn"
                                    onClick={() => {
                                      setDispatchModalCandidate(cand);
                                      setCustomDispatchMessage(cand.renderedMessage);
                                      setForceDispatch(cand.inCooldown);
                                    }}
                                    title="Preview rendered message and customize"
                                  >
                                    <Eye size={13} />
                                    <span>Preview</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {filteredReminderCandidates.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                              <CheckCircle2 size={32} style={{ color: '#10b981', marginBottom: '8px' }} />
                              <p style={{ margin: 0, fontWeight: 700, color: '#1a120c' }}>No audience candidates match the current filter.</p>
                              <small style={{ color: '#7d736b' }}>All customer interactions are currently up-to-date or protected by cooldown.</small>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SUB-TAB 2: AUTOMATION TRIGGER RULES ================= */}
            {reminderSubTab === 'rules' && (
              <div>
                <div className="reminder-rules-grid">
                  {reminderRules.map(rule => (
                    <div key={rule.id} className={`reminder-rule-card ${!rule.enabled ? 'paused' : ''}`}>
                      <div className="reminder-rule-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className={`role-badge ${rule.triggerType === 'near_reward' ? 'owner' : rule.triggerType === 'expiring_reward' ? 'manager' : rule.triggerType === 'first_visit' ? 'cashier' : 'kitchen'}`}>
                            {rule.triggerType === 'near_reward' ? 'Near-Reward' : rule.triggerType === 'inactive_days' ? 'Lapsed Diner' : rule.triggerType === 'expiring_reward' ? 'Expiring Reward' : 'Welcome'}
                          </span>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-dark, #1e1611)' }}>{rule.name}</h4>
                        </div>

                        <button
                          type="button"
                          className="staff-action-btn"
                          onClick={() => handleToggleRule(rule)}
                          title={rule.enabled ? 'Pause rule automation' : 'Enable rule automation'}
                        >
                          <Power size={13} style={{ color: rule.enabled ? '#10b981' : '#8c8279' }} />
                          <span>{rule.enabled ? 'Active' : 'Paused'}</span>
                        </button>
                      </div>

                      <div className="reminder-rule-params-row">
                        <div className="reminder-param-chip">
                          <Clock size={12} />
                          <span>Threshold: <b>{rule.daysThreshold} days</b></span>
                        </div>
                        <div className="reminder-param-chip">
                          <Shield size={12} />
                          <span>Anti-Spam Cooldown: <b>{rule.cooldownDays} days</b></span>
                        </div>
                        <div className="reminder-param-chip">
                          <MessageSquare size={12} />
                          <span>Channel: <b>WhatsApp Direct</b></span>
                        </div>
                      </div>

                      <div className="reminder-template-preview-box">
                        <span className="template-lbl">MESSAGE TEMPLATE</span>
                        <p>{rule.messageTemplate}</p>
                      </div>

                      <div className="reminder-rule-card-actions">
                        <button
                          type="button"
                          className="staff-action-btn"
                          onClick={() => handleOpenEditRuleModal(rule)}
                        >
                          <Pencil size={13} />
                          <span>Edit Rule</span>
                        </button>
                        <button
                          type="button"
                          className="staff-action-btn delete"
                          onClick={() => handleDeleteRule(rule)}
                          title="Delete rule"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {reminderRules.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
                      <Sliders size={36} style={{ marginBottom: '8px', opacity: 0.6 }} />
                      <p>No automation trigger rules configured yet.</p>
                      <button className="crm-btn-primary" onClick={handleOpenCreateRuleModal} style={{ marginTop: '8px' }} type="button">
                        <Plus size={14} /> Create First Rule
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================= SUB-TAB 3: DELIVERY AUDIT LOGS ================= */}
            {reminderSubTab === 'logs' && (
              <div>
                <div className="crm-table-container">
                  <div className="crm-table-responsive-wrapper">
                    <table className="crm-orders-table">
                      <thead>
                        <tr>
                          <th>RECIPIENT</th>
                          <th>TRIGGER TYPE</th>
                          <th>DISPATCHED AT</th>
                          <th>MESSAGE PREVIEW</th>
                          <th>STATUS</th>
                          <th style={{ textAlign: 'right' }}>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reminderLogs.map(log => (
                          <tr key={log.id} className="crm-orders-row">
                            <td>
                              <b style={{ color: '#1a120c' }}>{log.customerName}</b>
                              <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                                {log.customerPhone}
                              </small>
                            </td>

                            <td>
                              <span className="role-badge cashier" style={{ textTransform: 'uppercase' }}>
                                {log.triggerType?.replace('_', ' ')}
                              </span>
                            </td>

                            <td>
                              <div style={{ fontSize: '12.5px', color: '#1a120c' }}>
                                {new Date(log.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <small style={{ color: 'var(--text-subtle)', fontSize: '11px' }}>
                                {getTimeAgo(log.sentAt)}
                              </small>
                            </td>

                            <td>
                              <div style={{ maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12.5px', color: 'var(--text-primary)' }} title={log.messageContent}>
                                {log.messageContent}
                              </div>
                            </td>

                            <td>
                              <span className="crm-stat-tag ready" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Check size={11} />
                                <span>SENT</span>
                              </span>
                            </td>

                            <td>
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                {log.whatsAppUrl ? (
                                  <a
                                    href={log.whatsAppUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="crm-btn-whatsapp-sm"
                                    title="Open WhatsApp chat link"
                                  >
                                    <ExternalLink size={12} />
                                    <span>Chat Link</span>
                                  </a>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}

                        {reminderLogs.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                              No notifications sent yet. Run a scan or dispatch an audience reminder to populate audit history.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== PHASE 7: FEEDBACK & GOOGLE REVIEW BOOSTER TAB ===================== */}
        {tab === 'feedback' && (
          <div className="crm-orders-wrapper" style={{ padding: '0 0 40px 0' }}>
            {/* 1. Header Hero Card */}
            <div className="crm-orders-header-card">
              <div className="crm-orders-header-left">
                <div className="crm-orders-brand-emblem">
                  <Star size={24} style={{ color: '#DCEFE4' }} />
                </div>
                <div className="crm-orders-brand-info">
                  <div className="crm-orders-title-row">
                    <h2 className="crm-orders-title">Diner Feedback & Google Review Booster</h2>
                    <span className="crm-orders-live-badge">
                      <span className="crm-orders-live-pulse"></span>
                      GOOGLE BOOSTER ACTIVE
                    </span>
                  </div>
                  <p className="crm-orders-subtitle">
                    Intercept diner sentiment in real-time. Direct satisfied guests (4–5 Stars) to Google Maps with 1-click compliments, and route critical issues privately to management before public reviews happen.
                  </p>
                </div>
              </div>

              <div className="crm-orders-header-actions">
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={fetchFeedback}
                  disabled={loadingFeedback}
                >
                  <RefreshCw size={14} className={loadingFeedback ? 'loader-logo-spin' : ''} />
                  <span>{loadingFeedback ? 'Refreshing…' : 'Refresh Feedback'}</span>
                </button>

                <a
                  href={data?.cafe?.googleReviewUrl || 'https://g.page/r/gusstora-roastery/review'}
                  target="_blank"
                  rel="noreferrer"
                  className="crm-btn-primary"
                  title="Open live Google Maps review page"
                >
                  <Star size={15} fill="#fff" />
                  <span>Live Google Reviews</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>

            {/* 2. Top KPI Summary Grid */}
            <div className="crm-orders-metrics-grid">
              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap warm-orange">
                  <Star size={22} fill="#F59E0B" color="#F59E0B" />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Average Star Rating</span>
                  <div className="crm-stat-value" style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span>{feedbackStats?.averageRating || '5.0'}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>/ 5.0</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star
                        key={s}
                        size={12}
                        fill={s <= Math.round(Number(feedbackStats?.averageRating || 5)) ? '#F59E0B' : 'none'}
                        stroke="#F59E0B"
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap dark-roast">
                  <MessageSquare size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Total Diner Reviews</span>
                  <div className="crm-stat-value">{feedbackStats?.totalReviews || 0}</div>
                  <span className="crm-stat-sub">Across verified visits & orders</span>
                </div>
              </div>

              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap cognac">
                  <Sparkles size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Google Booster Rate</span>
                  <div className="crm-stat-value">{feedbackStats?.positivePercent || 100}%</div>
                  <span className="crm-stat-sub">Positive sentiment (4–5 stars)</span>
                </div>
              </div>

              <div className="crm-orders-stat-card">
                <div className={`crm-stat-icon-wrap ${feedbackStats?.unresolvedCount > 0 ? 'rose' : 'espresso'}`}>
                  <ShieldCheck size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Private Issues Needing Care</span>
                  <div className="crm-stat-value" style={{ color: feedbackStats?.unresolvedCount > 0 ? '#dc2626' : 'inherit' }}>
                    {feedbackStats?.unresolvedCount || 0}
                  </div>
                  <span className="crm-stat-sub">
                    {feedbackStats?.unresolvedCount > 0 ? 'Requires manager attention' : 'All critical items resolved'}
                  </span>
                </div>
              </div>
            </div>

            {/* Rating Breakdown & Aspect Sentiment Row */}
            <div className="feedback-breakdown-row">
              {/* Rating Distribution Visualizer */}
              <div className="breakdown-card rating-distribution-box">
                <div className="breakdown-card-head">
                  <BarChart3 size={16} className="text-terracotta" />
                  <h3>Star Rating Distribution</h3>
                </div>

                <div className="rating-bars-list">
                  {[5, 4, 3, 2, 1].map(stars => {
                    const count = feedbackStats?.ratingCounts?.[stars] || 0;
                    const total = feedbackStats?.totalReviews || 1;
                    const pct = Math.round((count / total) * 100);

                    return (
                      <div className="rating-bar-row" key={stars}>
                        <div className="bar-label-stars">
                          <span>{stars}</span>
                          <Star size={12} fill="#f59e0b" color="#f59e0b" />
                        </div>
                        <div className="bar-track">
                          <div
                            className={`bar-fill stars-${stars}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                        <div className="bar-count-pct">
                          <span className="count">{count}</span>
                          <span className="pct">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Aspect Mentions Cloud */}
              <div className="breakdown-card aspect-cloud-box">
                <div className="breakdown-card-head">
                  <Sparkles size={16} className="text-terracotta" />
                  <h3>Diner Mentions & Aspect Sentiment</h3>
                </div>

                <div className="aspect-sentiment-pills-list">
                  {feedbackStats?.aspectBreakdown && Object.keys(feedbackStats.aspectBreakdown).length > 0 ? (
                    Object.entries(feedbackStats.aspectBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([tag, count]) => {
                        const isCritical =
                          tag.includes('Slow') ||
                          tag.includes('Cold') ||
                          tag.includes('Noise') ||
                          tag.includes('Cleanliness');

                        return (
                          <div
                            key={tag}
                            className={`aspect-mention-pill ${isCritical ? 'critical' : 'positive'}`}
                          >
                            <span className="aspect-tag-text">{tag}</span>
                            <span className="aspect-count-badge">{count}</span>
                          </div>
                        );
                      })
                  ) : (
                    <div className="empty-aspects-notice">
                      <p>Diner aspect tags will appear here as reviews are submitted.</p>
                    </div>
                  )}
                </div>

                <div className="booster-tip-callout">
                  <strong><Sparkles size={14} className="text-gold" style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />Pro Growth Tip:</strong>
                  <p>
                    Diners giving 4–5 Stars are presented with 1-click preset compliments and directed straight to your Google Maps review page. Keep overall satisfaction above 90% to maintain a local top-3 ranking!
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Navigation Tabs */}
            <div className="feedback-filter-bar">
              <div className="filter-pill-group">
                <button
                  type="button"
                  className={`filter-pill-btn ${feedbackFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setFeedbackFilter('all')}
                >
                  <span>All Reviews ({feedbackList.length})</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn ${feedbackFilter === 'positive' ? 'active' : ''}`}
                  onClick={() => setFeedbackFilter('positive')}
                >
                  <Star size={13} fill="#f59e0b" color="#f59e0b" />
                  <span>Google Boosters (4–5 Stars)</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn ${feedbackFilter === 'critical' ? 'active' : ''}`}
                  onClick={() => setFeedbackFilter('critical')}
                >
                  <ShieldCheck size={13} />
                  <span>Private Attention (1–3 Stars)</span>
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn ${feedbackFilter === 'unresolved' ? 'active' : ''}`}
                  onClick={() => setFeedbackFilter('unresolved')}
                >
                  <AlertCircle size={13} />
                  <span>Unresolved Issues</span>
                  {feedbackStats?.unresolvedCount > 0 && (
                    <span className="filter-count-badge warning">{feedbackStats.unresolvedCount}</span>
                  )}
                </button>

                <button
                  type="button"
                  className={`filter-pill-btn ${feedbackFilter === 'resolved' ? 'active' : ''}`}
                  onClick={() => setFeedbackFilter('resolved')}
                >
                  <CheckCircle2 size={13} />
                  <span>Resolved Care</span>
                </button>
              </div>
            </div>

            {/* Reviews Grid */}
            <div className="feedback-cards-grid">
              {filteredFeedbackList.map(fb => {
                const isPositive = fb.rating >= 4;
                const isCritical = fb.rating <= 3;
                const isUnresolved = fb.status === 'unresolved';

                return (
                  <div
                    key={fb._id || fb.id}
                    className={`owner-feedback-card ${isPositive ? 'positive-card' : 'critical-card'} ${
                      isCritical && isUnresolved ? 'needs-resolution' : ''
                    }`}
                  >
                    {/* Card Top Row */}
                    <div className="feedback-card-top-row">
                      <div className="feedback-diner-info">
                        <div
                          className="diner-avatar-small"
                          style={{
                            backgroundColor: isPositive ? '#ecfdf5' : '#fff1f2',
                            color: isPositive ? '#065f46' : '#9f1239'
                          }}
                        >
                          {fb.dinerName?.[0] || 'D'}
                        </div>
                        <div>
                          <strong className="diner-name-title">{fb.dinerName || 'Guest'}</strong>
                          <div className="diner-contact-sub">
                            {fb.dinerPhone ? (
                              <a
                                href={`https://wa.me/91${fb.dinerPhone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="diner-phone-link"
                                title="Open WhatsApp chat with guest"
                              >
                                <Phone size={11} />
                                <span>{fb.dinerPhone}</span>
                              </a>
                            ) : (
                              <span>In-Store Diner</span>
                            )}
                            <span className="bullet-sep">•</span>
                            <span className="time-ago">{getTimeAgo(fb.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stars & Sentiment Badge */}
                      <div className="feedback-sentiment-block">
                        <div className="feedback-star-display">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star
                              key={s}
                              size={15}
                              fill={s <= fb.rating ? (isPositive ? '#f59e0b' : '#f43f5e') : 'none'}
                              stroke={isPositive ? '#f59e0b' : '#f43f5e'}
                            />
                          ))}
                          <span className="rating-num-bold">{fb.rating}.0</span>
                        </div>

                        <span
                          className={`feedback-routing-badge ${isPositive ? 'public-boost' : 'private-intercept'}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          {isPositive ? <><Star size={12} fill="#f59e0b" color="#f59e0b" /> Google Booster (Public)</> : <><ShieldCheck size={12} /> Private Manager Intercept</>}
                        </span>
                      </div>
                    </div>

                    {/* Order Link Pill */}
                    {fb.Order && (
                      <div className="feedback-order-reference-pill">
                        <PackageOpen size={12} />
                        <span>Order #{fb.Order.orderNo}</span>
                        <span className="bullet-sep">•</span>
                        <span>{fb.Order.table ? `Table #${fb.Order.table}` : 'Takeaway'}</span>
                        <span className="bullet-sep">•</span>
                        <span>Total: {money(fb.Order.total)}</span>
                      </div>
                    )}

                    {/* Aspect Tags */}
                    {fb.aspects && fb.aspects.length > 0 && (
                      <div className="feedback-aspects-cluster">
                        {fb.aspects.map((aspect, i) => (
                          <span key={i} className={`aspect-tag-chip ${isPositive ? 'pos' : 'crit'}`}>
                            {aspect}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Diner Comment */}
                    {fb.comment ? (
                      <div className="feedback-comment-quote">
                        <p>"{fb.comment}"</p>
                      </div>
                    ) : (
                      <div className="feedback-comment-quote empty">
                        <p>No written comment provided.</p>
                      </div>
                    )}

                    {/* Card Resolution Action / Status Footer */}
                    <div className="feedback-card-footer">
                      {isCritical ? (
                        fb.status === 'resolved' ? (
                          <div className="resolved-status-box">
                            <div className="resolved-status-title">
                              <CheckCircle2 size={15} className="text-emerald" />
                              <strong>Resolved by {fb.resolvedBy || 'Management'}</strong>
                              {fb.resolvedAt && (
                                <span className="resolved-date">
                                  ({new Date(fb.resolvedAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short'
                                  })})
                                </span>
                              )}
                            </div>
                            {fb.resolutionNotes && (
                              <p className="resolved-notes-text">"{fb.resolutionNotes}"</p>
                            )}
                          </div>
                        ) : (
                          <div className="unresolved-action-bar">
                            <div className="unresolved-indicator">
                              <AlertCircle size={15} className="text-rose" />
                              <span>Critical complaint awaiting management action</span>
                            </div>
                            <button
                              type="button"
                              className="crm-btn-primary sm"
                              onClick={() => {
                                setResolvingFeedbackModal(fb);
                                setResolutionNotesInput('');
                              }}
                            >
                              <ShieldCheck size={14} />
                              <span>Resolve & Record Action</span>
                            </button>
                          </div>
                        )
                      ) : (
                        <div className="positive-status-footer">
                          <span className="positive-thank-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <CheckCircle2 size={13} className="text-emerald" /> 5-Star guest experience. Prompted for Google Maps review.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredFeedbackList.length === 0 && (
                <div className="empty-feedback-state">
                  <Star size={36} className="text-gold" />
                  <h3>No reviews matching this filter</h3>
                  <p>Try switching to another filter tab or browse all reviews.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: QR TABLE KIT GENERATOR ===================== */}
        {tab === 'qr-kit' && (
          <div className="crm-orders-wrapper qr-kit-dashboard-view" style={{ padding: '0 0 40px 0' }}>
            {/* Top Kit Action Bar */}
            <div className="crm-orders-header-card">
              <div className="crm-orders-header-left">
                <div className="crm-orders-brand-emblem">
                  <QrCode size={24} style={{ color: '#DCEFE4' }} />
                </div>
                <div className="crm-orders-brand-info">
                  <div className="crm-orders-title-row">
                    <h2 className="crm-orders-title">Printable Tabletop QR Standee Kit</h2>
                    <span className="crm-orders-live-badge">
                      <span className="crm-orders-live-pulse"></span>
                      PRINT READY (A6 / 4x6 / DISCS)
                    </span>
                  </div>
                  <p className="crm-orders-subtitle">
                    Generate, customize, and print high-resolution tabletop standees and scannable coasters for Table 01 to {data?.cafe?.tables || 12}.
                  </p>
                </div>
              </div>

              <div className="crm-orders-header-actions">
                <a
                  href={`/c/${data?.cafe?.slug || 'demo-cafe'}?table=T-${String(qrKitPreviewTableIndex).padStart(2, '0')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="crm-btn-secondary"
                >
                  <ExternalLink size={14} />
                  <span>Test Scan Live Menu</span>
                </a>
                <button
                  type="button"
                  className="crm-btn-primary"
                  onClick={() => window.print()}
                >
                  <Download size={15} />
                  <span>Print {qrKitTableSelection === 'all' ? `All ${data?.cafe?.tables || 12} Standees` : `Table ${qrKitSelectedTable} Standee`}</span>
                </button>
              </div>
            </div>

            {/* Split Layout: Controls Left, Live Standee Preview Right */}
            <div className="qr-kit-workspace-grid">
              
              {/* Left Column: Controls & Configuration Panel */}
              <div className="qr-kit-controls-column">
                
                {/* 1. Standee Layout Presets */}
                <div className="panel-box mb-4">
                  <div className="panel-header-row mb-3">
                    <div>
                      <h3 className="panel-title">1. Standee Design Preset</h3>
                      <p className="panel-sub">Select physical format and layout styling</p>
                    </div>
                  </div>

                  <div className="qr-preset-picker-grid">
                    {[
                      { id: 'tent', name: 'Table Tent Standee', desc: 'Foldable A6 / 4x6" portrait acrylic standee with bold header & 3-step ordering flow.', tag: 'Popular' },
                      { id: 'compact', name: 'Counter & Coaster Sticker', desc: 'Square 1:1 compact sticker format for small tables, bar tops, or coaster discs.', tag: 'Compact' },
                      { id: 'luxe', name: 'Luxe Fine Dining Card', desc: 'High-elegance ivory/charcoal bordered card with refined typography and understated luxury.', tag: 'Luxe' }
                    ].map(preset => {
                      const isSel = qrKitPreset === preset.id;
                      return (
                        <div
                          key={preset.id}
                          className={`qr-preset-card ${isSel ? 'selected' : ''}`}
                          onClick={() => setQrKitPreset(preset.id)}
                        >
                          <div className="qr-preset-card-top">
                            <span className="qr-preset-title">{preset.name}</span>
                            <span className={`qr-preset-tag ${preset.id}`}>{preset.tag}</span>
                          </div>
                          <p className="qr-preset-desc">{preset.desc}</p>
                          {isSel && <div className="qr-preset-check"><Check size={14} /></div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Print Scope & Tables */}
                <div className="panel-box mb-4">
                  <div className="panel-header-row mb-3">
                    <div>
                      <h3 className="panel-title">2. Table Selection & Scope</h3>
                      <p className="panel-sub">Choose whether to print all café tables or a single table card</p>
                    </div>
                  </div>

                  <div className="segmented-control mb-3">
                    <button
                      type="button"
                      className={`seg-btn ${qrKitTableSelection === 'all' ? 'active' : ''}`}
                      onClick={() => setQrKitTableSelection('all')}
                    >
                      All Tables (1 to {data?.cafe?.tables || 12})
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${qrKitTableSelection === 'single' ? 'active' : ''}`}
                      onClick={() => setQrKitTableSelection('single')}
                    >
                      Single Table Card
                    </button>
                  </div>

                  {qrKitTableSelection === 'single' && (
                    <div className="table-selector-row mb-3">
                      <label className="onboard-label">
                        <span>Select Specific Table:</span>
                      </label>
                      <select
                        className="onboard-input onboard-select"
                        value={qrKitSelectedTable}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setQrKitSelectedTable(val);
                          setQrKitPreviewTableIndex(val);
                        }}
                      >
                        {Array.from({ length: data?.cafe?.tables || 12 }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>
                            Table {String(num).padStart(2, '0')} (T-{String(num).padStart(2, '0')})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="table-count-hint-box">
                    <Sliders size={14} />
                    <span>
                      Café currently has <strong>{data?.cafe?.tables || 12} tables</strong> configured. Need more? Update in{' '}
                      <button type="button" className="link-inline-btn" onClick={() => setTab('settings')}>
                        Settings
                      </button>.
                    </span>
                  </div>
                </div>

                {/* 3. Messaging & Wi-Fi Options */}
                <div className="panel-box mb-4">
                  <div className="panel-header-row mb-3">
                    <div>
                      <h3 className="panel-title">3. Call-to-Action & Guest Amenities</h3>
                      <p className="panel-sub">Custom message and Wi-Fi access printed on card</p>
                    </div>
                  </div>

                  <div className="theme-form-grid">
                    <label className="full-width">
                      <span>Call-to-Action Headline</span>
                      <input
                        type="text"
                        value={qrKitCustomHeadline}
                        onChange={e => setQrKitCustomHeadline(e.target.value)}
                        placeholder="Scan to Order & Collect Stamps"
                      />
                    </label>

                    <div className="cta-preset-chips mb-2 full-width">
                      {[
                        'Scan to Order & Collect Stamps',
                        'Browse Menu & Order from Phone',
                        'Tabletop Contactless Ordering'
                      ].map(txt => (
                        <button
                          key={txt}
                          type="button"
                          className={`cta-chip ${qrKitCustomHeadline === txt ? 'active' : ''}`}
                          onClick={() => setQrKitCustomHeadline(txt)}
                        >
                          {txt}
                        </button>
                      ))}
                    </div>

                    {/* Wi-Fi Details Toggle */}
                    <div className="full-width wifi-toggle-box">
                      <label className="wifi-checkbox-label">
                        <input
                          type="checkbox"
                          checked={qrKitIncludeWifi}
                          onChange={e => setQrKitIncludeWifi(e.target.checked)}
                        />
                        <div className="wifi-checkbox-text">
                          <strong>Print Guest Wi-Fi Credentials on Standee</strong>
                          <span>Permits diners to easily connect without asking staff</span>
                        </div>
                      </label>
                    </div>

                    {qrKitIncludeWifi && (
                      <>
                        <label>
                          <span>Wi-Fi Network (SSID)</span>
                          <input
                            type="text"
                            value={qrKitWifiSsid}
                            onChange={e => setQrKitWifiSsid(e.target.value)}
                            placeholder="e.g. Gusstora_Guest_5G"
                          />
                        </label>
                        <label>
                          <span>Wi-Fi Password</span>
                          <input
                            type="text"
                            value={qrKitWifiPassword}
                            onChange={e => setQrKitWifiPassword(e.target.value)}
                            placeholder="e.g. coffee2026"
                          />
                        </label>
                      </>
                    )}

                    {/* Contrast Mode */}
                    <label className="full-width">
                      <span>QR Code Color Palette</span>
                      <div className="contrast-mode-buttons">
                        <button
                          type="button"
                          className={`contrast-btn ${qrKitContrastMode === 'brand' ? 'active' : ''}`}
                          onClick={() => setQrKitContrastMode('brand')}
                        >
                          <span className="contrast-dot" style={{ backgroundColor: data?.cafe?.brandColor || '#176B50' }} />
                          <span>Brand Accent ({data?.cafe?.brandColor || '#176B50'})</span>
                        </button>
                        <button
                          type="button"
                          className={`contrast-btn ${qrKitContrastMode === 'dark' ? 'active' : ''}`}
                          onClick={() => setQrKitContrastMode('dark')}
                        >
                          <span className="contrast-dot dark" />
                          <span>Pure Black (Maximum Contrast)</span>
                        </button>
                      </div>
                    </label>
                  </div>
                </div>

              </div>

              {/* Right Column: Interactive Standee Card Preview */}
              <div className="qr-kit-preview-column">
                <div className="panel-box preview-sticky-panel">
                  
                  {/* Table Switcher Bar */}
                  <div className="preview-table-nav-row">
                    <button
                      type="button"
                      className="table-nav-arrow"
                      disabled={qrKitPreviewTableIndex <= 1}
                      onClick={() => setQrKitPreviewTableIndex(p => Math.max(1, p - 1))}
                    >
                      <ArrowLeft size={16} />
                      <span>Prev</span>
                    </button>
                    
                    <div className="table-nav-center">
                      <span className="table-nav-title">
                        Previewing Table {String(qrKitPreviewTableIndex).padStart(2, '0')}
                      </span>
                      <span className="table-nav-total">
                        ({qrKitPreviewTableIndex} of {data?.cafe?.tables || 12} tables)
                      </span>
                    </div>

                    <button
                      type="button"
                      className="table-nav-arrow"
                      disabled={qrKitPreviewTableIndex >= (data?.cafe?.tables || 12)}
                      onClick={() => setQrKitPreviewTableIndex(p => Math.min(data?.cafe?.tables || 12, p + 1))}
                    >
                      <span>Next</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>

                  {/* Physical Standee Card Rendering */}
                  <div className="standee-render-wrapper">
                    <div className={`standee-card-visual preset-${qrKitPreset}`}>
                      
                      {/* Top Accent Stripe / Brand Header */}
                      <div
                        className="standee-header-stripe"
                        style={{
                          backgroundColor: qrKitContrastMode === 'brand' ? (data?.cafe?.brandColor || '#176B50') : '#18181b'
                        }}
                      >
                        <Coffee size={18} className="standee-logo-icon" />
                        <span className="standee-cafe-name">{data?.cafe?.name || 'Gusstora Roastery'}</span>
                      </div>

                      {/* Standee Body */}
                      <div className="standee-body-content">
                        
                        {/* Table Badge */}
                        <div
                          className="standee-table-badge"
                          style={{
                            color: qrKitContrastMode === 'brand' ? (data?.cafe?.brandColor || '#176B50') : '#18181b',
                            borderColor: qrKitContrastMode === 'brand' ? `${data?.cafe?.brandColor || '#176B50'}44` : '#d1d5db',
                            backgroundColor: qrKitContrastMode === 'brand' ? `${data?.cafe?.brandColor || '#176B50'}11` : '#f3f4f6'
                          }}
                        >
                          <span>TABLE {String(qrKitPreviewTableIndex).padStart(2, '0')}</span>
                        </div>

                        {/* Custom Headline */}
                        <h4 className="standee-headline">{qrKitCustomHeadline}</h4>
                        <p className="standee-tagline">
                          {data?.cafe?.tagline || 'Specialty Coffee, Artisan Bakes & Warm Moments'}
                        </p>

                        {/* High-Resolution QR Code */}
                        <div className="standee-qr-frame">
                          <QRCodeSVG
                            value={`${window.location.origin}/c/${data?.cafe?.slug || 'demo-cafe'}?table=T-${String(qrKitPreviewTableIndex).padStart(2, '0')}`}
                            size={180}
                            level="H"
                            includeMargin={true}
                            fgColor={qrKitContrastMode === 'brand' ? (data?.cafe?.brandColor || '#176B50') : '#111827'}
                          />
                        </div>

                        {/* 3-Step Dining Guide */}
                        <div className="standee-steps-flow">
                          <div className="standee-step">
                            <span className="step-num">1</span>
                            <span className="step-txt">Open camera & scan</span>
                          </div>
                          <div className="step-divider">›</div>
                          <div className="standee-step">
                            <span className="step-num">2</span>
                            <span className="step-txt">Pick items & order</span>
                          </div>
                          <div className="step-divider">›</div>
                          <div className="standee-step">
                            <span className="step-num">3</span>
                            <span className="step-txt">Earn free rewards</span>
                          </div>
                        </div>

                        {/* Wi-Fi Info Box */}
                        {qrKitIncludeWifi && (qrKitWifiSsid || qrKitWifiPassword) && (
                          <div className="standee-wifi-box">
                            <div className="standee-wifi-title">
                              <Wifi size={13} />
                              <span>Complimentary Guest Wi-Fi</span>
                            </div>
                            <div className="standee-wifi-credentials">
                              {qrKitWifiSsid && (
                                <div className="wifi-cred-line">
                                  <span className="cred-lbl">Network:</span>
                                  <span className="cred-val">{qrKitWifiSsid}</span>
                                </div>
                              )}
                              {qrKitWifiPassword && (
                                <div className="wifi-cred-line">
                                  <span className="cred-lbl">Password:</span>
                                  <span className="cred-val">{qrKitWifiPassword}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Footer watermark */}
                        <div className="standee-footer-note">
                          <span>Powered by PerkByte Smart Dining</span>
                        </div>
                      </div>

                      {/* Fold / Cut Guide Lines */}
                      <div className="standee-fold-indicator">
                        <span>- - - - - FOLD HERE FOR ACRYLIC TENT CARD - - - - -</span>
                      </div>
                    </div>
                  </div>

                  {/* Scannable Table URL Display & Copy */}
                  <div className="preview-url-box mt-3">
                    <div className="preview-url-text">
                      <span className="url-label">Encoded Destination URL:</span>
                      <code className="url-code">
                        {`${window.location.origin}/c/${data?.cafe?.slug || 'demo-cafe'}?table=T-${String(qrKitPreviewTableIndex).padStart(2, '0')}`}
                      </code>
                    </div>
                    <button
                      type="button"
                      className="crm-btn-secondary sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/c/${data?.cafe?.slug || 'demo-cafe'}?table=T-${String(qrKitPreviewTableIndex).padStart(2, '0')}`
                        );
                        setCopiedTableUrl(true);
                        setTimeout(() => setCopiedTableUrl(false), 2500);
                      }}
                    >
                      {copiedTableUrl ? (
                        <>
                          <Check size={13} className="text-emerald" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 1-Click Print Button */}
                  <button
                    type="button"
                    className="crm-btn-primary full-width mt-3"
                    onClick={() => window.print()}
                  >
                    <Download size={16} />
                    <span>Print Standees Now</span>
                  </button>

                </div>
              </div>

            </div>

            {/* ================= HIDDEN PRINT STREAM CONTAINER ================= */}
            {/* This container only renders during window.print() via @media print CSS */}
            <div className="qr-kit-print-container" aria-hidden="true">
              {(qrKitTableSelection === 'all'
                ? Array.from({ length: data?.cafe?.tables || 12 }, (_, i) => i + 1)
                : [qrKitSelectedTable]
              ).map(tNum => (
                <div key={tNum} className={`printable-standee-page preset-${qrKitPreset}`}>
                  <div className="print-card-outer">
                    {/* Header */}
                    <div
                      className="print-card-header"
                      style={{
                        backgroundColor: qrKitContrastMode === 'brand' ? (data?.cafe?.brandColor || '#176B50') : '#111827'
                      }}
                    >
                      <Coffee size={24} className="print-header-icon" />
                      <h2 className="print-header-title">{data?.cafe?.name || 'Gusstora Roastery'}</h2>
                    </div>

                    <div className="print-card-body">
                      {/* Table Badge */}
                      <div
                        className="print-table-badge"
                        style={{
                          borderColor: qrKitContrastMode === 'brand' ? (data?.cafe?.brandColor || '#176B50') : '#111827',
                          color: qrKitContrastMode === 'brand' ? (data?.cafe?.brandColor || '#176B50') : '#111827'
                        }}
                      >
                        TABLE {String(tNum).padStart(2, '0')}
                      </div>

                      <h3 className="print-card-headline">{qrKitCustomHeadline}</h3>
                      <p className="print-card-tagline">{data?.cafe?.tagline || 'Specialty Coffee & Handcrafted Brews'}</p>

                      {/* Large High-DPI QR Code */}
                      <div className="print-qr-code-wrap">
                        <QRCodeSVG
                          value={`${window.location.origin}/c/${data?.cafe?.slug || 'demo-cafe'}?table=T-${String(tNum).padStart(2, '0')}`}
                          size={240}
                          level="H"
                          includeMargin={true}
                          fgColor={qrKitContrastMode === 'brand' ? (data?.cafe?.brandColor || '#176B50') : '#111827'}
                        />
                      </div>

                      {/* 3 Step Ordering Instructions */}
                      <div className="print-steps-grid">
                        <div className="print-step-item">
                          <span className="print-step-bubble">1</span>
                          <span className="print-step-text">Scan with Phone Camera</span>
                        </div>
                        <div className="print-step-item">
                          <span className="print-step-bubble">2</span>
                          <span className="print-step-text">Order Your Favorites</span>
                        </div>
                        <div className="print-step-item">
                          <span className="print-step-bubble">3</span>
                          <span className="print-step-text">Unlock Free Rewards</span>
                        </div>
                      </div>

                      {/* Wi-Fi Details */}
                      {qrKitIncludeWifi && (qrKitWifiSsid || qrKitWifiPassword) && (
                        <div className="print-wifi-footer">
                          <div className="print-wifi-label">
                            <Wifi size={14} />
                            <strong>Guest Wi-Fi Access</strong>
                          </div>
                          <div className="print-wifi-details">
                            {qrKitWifiSsid && <span>Network: <strong>{qrKitWifiSsid}</strong></span>}
                            {qrKitWifiPassword && <span>Password: <strong>{qrKitWifiPassword}</strong></span>}
                          </div>
                        </div>
                      )}

                      <div className="print-footer-watermark">
                        <span>perkbyte.app/c/{data?.cafe?.slug || 'demo-cafe'} • Powered by PerkByte Platform</span>
                      </div>
                    </div>

                    <div className="print-fold-line" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Scissors size={12} /> - - - - - - - - - - - - - - FOLD HERE FOR STAND - - - - - - - - - - - - - - <Scissors size={12} style={{ transform: 'scaleX(-1)' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ===================== TAB: SECURITY & AUDIT LOGS (PHASE 9) ===================== */}
        {tab === 'security' && (isOwner || isManager) && (
          <div className="crm-orders-wrapper" style={{ padding: '0 0 40px 0' }}>
            {/* 1. Header Hero Card */}
            <div className="crm-orders-header-card">
              <div className="crm-orders-header-left">
                <div className="crm-orders-brand-emblem">
                  <ShieldCheck size={24} style={{ color: '#DCEFE4' }} />
                </div>
                <div className="crm-orders-brand-info">
                  <div className="crm-orders-title-row">
                    <h2 className="crm-orders-title">Security & Centralized Audit Trail</h2>
                    <span className="crm-orders-live-badge">
                      <span className="crm-orders-live-pulse"></span>
                      ROTATION SHIELD ACTIVE
                    </span>
                  </div>
                  <p className="crm-orders-subtitle">
                    Enterprise-grade short-lived JWT access tokens (15m) paired with SHA-256 persistent refresh token rotation (30d), automated family replay protection, and real-time immutable security audit logging.
                  </p>
                </div>
              </div>

              <div className="crm-orders-header-actions">
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => {
                    fetchAuditLogs(auditPage);
                    fetchSessions();
                  }}
                  disabled={loadingAudit}
                >
                  <RefreshCw size={14} className={loadingAudit ? 'loader-logo-spin' : ''} />
                  <span>Refresh Trail</span>
                </button>

                <button
                  type="button"
                  className="crm-btn-secondary"
                  style={{ borderColor: '#fca5a5', color: '#dc2626' }}
                  onClick={handleRevokeAllSessions}
                  disabled={revokingSessions}
                  title="Revokes all refresh tokens and invalidates remote logins across other devices"
                >
                  <Power size={14} />
                  <span>{revokingSessions ? 'Revoking…' : 'Revoke All Other Sessions'}</span>
                </button>
              </div>
            </div>

            {/* 2. Top KPI Summary Grid */}
            <div className="crm-orders-metrics-grid">
              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap cognac">
                  <Activity size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">7-Day Event Volume</span>
                  <div className="crm-stat-value">{auditStats?.total7d ?? auditLogs.length}</div>
                  <span className="crm-stat-sub">Total recorded lifecycle events</span>
                </div>
              </div>

              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap dark-roast">
                  <Laptop size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Active Device Grants</span>
                  <div className="crm-stat-value">{auditStats?.activeSessionsCount || activeSessions.length || 1}</div>
                  <span className="crm-stat-sub">Authorized refresh token families</span>
                </div>
              </div>

              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap warm-orange">
                  <ShieldAlert size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Critical Security Actions</span>
                  <div className="crm-stat-value">{auditStats?.criticalActionsCount ?? 0}</div>
                  <span className="crm-stat-sub">Staff, token revoke & config alerts</span>
                </div>
              </div>

              <div className="crm-orders-stat-card">
                <div className="crm-stat-icon-wrap emerald">
                  <Lock size={22} />
                </div>
                <div className="crm-stat-content">
                  <span className="crm-stat-label">Token Protocol Status</span>
                  <div className="crm-stat-value" style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px', color: '#047857' }}>
                    <span className="crm-orders-live-pulse" style={{ width: 8, height: 8 }} />
                    Active Shield
                  </div>
                  <span className="crm-stat-sub">15m Access / 30d Refresh Family</span>
                </div>
              </div>
            </div>

            {/* Active Sessions Strip */}
            <div className="security-sessions-card">
              <div className="card-top-row">
                <div className="card-top-left">
                  <Smartphone size={18} className="text-terracotta" />
                  <h3 className="section-subheading">Active Login Sessions ({activeSessions.length})</h3>
                </div>
                <span className="sessions-tagline">Tracked SHA-256 persistent token grants</span>
              </div>

              {activeSessions.length === 0 ? (
                <div className="empty-substate">
                  <span>No background sessions registered yet. Current session active.</span>
                </div>
              ) : (
                <div className="active-sessions-grid">
                  {activeSessions.map((s, idx) => {
                    const devInfo = parseDeviceUa(s.userAgent);
                    const isMobile = devInfo.device === 'mobile';
                    const isTablet = devInfo.device === 'tablet';
                    return (
                      <div key={s.id || idx} className="session-item-badge">
                        <div className="session-device-icon">
                          {isMobile ? <Smartphone size={19} /> : isTablet ? <Tablet size={19} /> : <Laptop size={19} />}
                        </div>
                        <div className="session-device-info">
                          <div className="session-title-row">
                            <span className="session-device-title" title={s.userAgent}>
                              {devInfo.browser} • {devInfo.os}
                            </span>
                            <span className="session-state-pill">
                              <span className="pulse-dot green" style={{ width: 6, height: 6 }} />
                              Online
                            </span>
                          </div>
                          <div className="session-ip-row">
                            <Globe size={12} className="text-subtle" />
                            <span className="session-ip">{formatClientIp(s.ipAddress)}</span>
                          </div>
                          <div className="session-date-sub">
                            <span>{getTimeAgo(s.createdAt)} • <code>{s.family ? s.family.slice(0, 8) : 'grant'}…</code></span>
                            {s.id && (
                              <button
                                className="session-revoke-link"
                                onClick={() => handleRevokeSingleSession(s.id)}
                                title="Revoke this device session"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Audit Logs Filter Toolbar */}
            <div className="audit-filter-card">
              <div className="audit-filter-top">
                <div className="category-pill-tabs">
                  {[
                    { id: 'all', label: 'All Events', icon: null },
                    { id: 'auth', label: 'Auth & Access', icon: Lock },
                    { id: 'staff', label: 'Staff & Roles', icon: Users },
                    { id: 'menu', label: 'Menu Catalog', icon: Utensils },
                    { id: 'loyalty', label: 'Loyalty & Rewards', icon: Gift },
                    { id: 'settings', label: 'Cafe Settings', icon: Settings },
                  ].map(cat => {
                    const CatIcon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        className={`cat-pill-btn ${auditCategory === cat.id ? 'active' : ''}`}
                        onClick={() => {
                          setAuditCategory(cat.id);
                          fetchAuditLogs(1, cat.id, auditStatus, auditSearch);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        {CatIcon && <CatIcon size={13} />}
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="audit-search-wrap">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search by action, user or IP..."
                    value={auditSearch}
                    onChange={e => {
                      setAuditSearch(e.target.value);
                      fetchAuditLogs(1, auditCategory, auditStatus, e.target.value);
                    }}
                    className="audit-search-input"
                  />
                  {auditSearch && (
                    <button
                      className="search-clear-btn"
                      onClick={() => {
                        setAuditSearch('');
                        fetchAuditLogs(1, auditCategory, auditStatus, '');
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="audit-status-strip">
                <span className="filter-label">Filter Outcome:</span>
                {['all', 'success', 'warning', 'failure'].map(st => (
                  <button
                    key={st}
                    className={`status-filter-chip ${auditStatus === st ? 'active' : ''} ${st}`}
                    onClick={() => {
                      setAuditStatus(st);
                      fetchAuditLogs(1, auditCategory, st, auditSearch);
                    }}
                  >
                    {st === 'all' ? 'All Outcomes' : st.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="crm-table-container">
              {loadingAudit ? (
                <div className="audit-loading-wrap" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={28} className="loader-logo-spin" style={{ color: '#176B50', margin: '0 auto 12px' }} />
                  <div>Loading audit log entries…</div>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="audit-empty-wrap" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <ShieldCheck size={48} style={{ color: '#d1c7bc', margin: '0 auto 12px' }} />
                  <h3 style={{ color: '#1a120c', fontSize: '16px', fontWeight: 800 }}>No Audit Logs Found</h3>
                  <p style={{ fontSize: '13px', marginTop: 4 }}>Try adjusting your category, status, or search filters above.</p>
                </div>
              ) : (
                <div className="crm-table-responsive-wrapper">
                  <table className="crm-orders-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Actor</th>
                        <th>Category</th>
                        <th>Action</th>
                        <th>Status</th>
                        <th>Client & IP</th>
                        <th style={{ textAlign: 'right' }}>Payload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map(log => (
                        <tr key={log.id || log._id} className="crm-orders-row">
                          <td className="cell-time">
                            <span className="time-ago" style={{ fontWeight: 700, color: '#1a120c', display: 'block' }}>{getTimeAgo(log.createdAt)}</span>
                            <small className="time-full" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                              {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </small>
                          </td>
                          <td className="cell-actor">
                            <div className="actor-badge" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span className="actor-name" style={{ fontWeight: 700, color: '#1a120c' }}>{log.userName || 'System'}</span>
                              <span className={`role-badge ${log.userRole}`} style={{ fontSize: '10px', textTransform: 'uppercase' }}>{log.userRole}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`category-tag ${log.category}`}>{log.category?.toUpperCase()}</span>
                          </td>
                          <td className="cell-action">
                            <code className="action-code">{log.action}</code>
                          </td>
                          <td>
                            <span className={`outcome-pill ${log.status}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {log.status === 'success' ? (
                                <><Check size={11} strokeWidth={2.5} /> SUCCESS</>
                              ) : log.status === 'warning' ? (
                                <><AlertTriangle size={11} strokeWidth={2.5} /> WARNING</>
                              ) : (
                                <><X size={11} strokeWidth={2.5} /> FAILURE</>
                              )}
                            </span>
                          </td>
                          <td className="cell-client">
                            <span className="client-ip" style={{ fontWeight: 600, color: '#1a120c', display: 'block' }}>{log.ipAddress || '127.0.0.1'}</span>
                            <small className="client-ua" style={{ color: 'var(--text-muted)', fontSize: '11px' }} title={log.userAgent}>
                              {log.userAgent ? log.userAgent.slice(0, 24) + '…' : 'Internal'}
                            </small>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="inspect-btn"
                              onClick={() => setSelectedAuditLog(log)}
                            >
                              <Eye size={14} />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Footer */}
              {auditTotalPages > 1 && (
                <div className="audit-pagination">
                  <span className="pagination-info">
                    Page <b>{auditPage}</b> of <b>{auditTotalPages}</b>
                  </span>
                  <div className="pagination-actions">
                    <button
                      className="page-btn"
                      disabled={auditPage <= 1}
                      onClick={() => fetchAuditLogs(auditPage - 1)}
                    >
                      Previous
                    </button>
                    <button
                      className="page-btn"
                      disabled={auditPage >= auditTotalPages}
                      onClick={() => fetchAuditLogs(auditPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Audit Log Inspector Modal */}
            {selectedAuditLog && (
              <div className="modal-backdrop" onClick={() => setSelectedAuditLog(null)}>
                <div className="theme-modal-card audit-inspect-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-top-row">
                    <div>
                      <span className="modal-order-tag">Audit Event Record</span>
                      <h2 className="modal-order-num">{selectedAuditLog.action}</h2>
                    </div>
                    <button className="modal-close-icon" onClick={() => setSelectedAuditLog(null)}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="audit-inspect-grid">
                    <div className="inspect-field">
                      <span className="lbl">Event ID</span>
                      <code>{selectedAuditLog.id || selectedAuditLog._id}</code>
                    </div>
                    <div className="inspect-field">
                      <span className="lbl">Status</span>
                      <span className={`outcome-pill ${selectedAuditLog.status}`}>
                        {selectedAuditLog.status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="inspect-field">
                      <span className="lbl">Actor</span>
                      <b>{selectedAuditLog.userName} ({selectedAuditLog.userRole})</b>
                    </div>
                    <div className="inspect-field">
                      <span className="lbl">Timestamp</span>
                      <span>{new Date(selectedAuditLog.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="inspect-field">
                      <span className="lbl">IP Address</span>
                      <code>{selectedAuditLog.ipAddress || '127.0.0.1'}</code>
                    </div>
                    <div className="inspect-field">
                      <span className="lbl">Client / User Agent</span>
                      <span className="inspect-ua-wrap">{selectedAuditLog.userAgent || 'Unknown'}</span>
                    </div>
                  </div>

                  <div className="audit-inspect-payload-wrap">
                    <span className="lbl">Structured Event Payload</span>
                    <pre className="audit-payload-json">
                      {JSON.stringify(selectedAuditLog.details || {}, null, 2)}
                    </pre>
                  </div>

                  <div className="modal-actions-right">
                    <button className="crm-btn-secondary" onClick={() => setSelectedAuditLog(null)}>
                      Close Inspector
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== ORDER DETAILS MODAL ===================== */}
        {selectedOrder && (
          <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
            <div className="theme-modal-card" onClick={e => e.stopPropagation()}>
              <div className="modal-top-row">
                <div>
                  <span className="modal-order-tag">Order Details</span>
                  <h2 className="modal-order-num">{selectedOrder.orderNo}</h2>
                </div>
                <button className="modal-close-icon" onClick={() => setSelectedOrder(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-details-grid">
                <div>
                  <span className="lbl">Customer</span>
                  <b>{selectedOrder.customerName}</b>
                  <small>{selectedOrder.phone}</small>
                </div>
                <div>
                  <span className="lbl">Table / Channel</span>
                  <b>Table {selectedOrder.table}</b>
                  <small>{getTimeAgo(selectedOrder.createdAt)}</small>
                </div>
                <div>
                  <span className="lbl">Payment Status</span>
                  <span className={`status-pill payment ${selectedOrder.paymentStatus}`}>
                    {selectedOrder.paymentStatus.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="lbl">Order Status</span>
                  <span className={`status-pill order-state ${selectedOrder.status}`}>
                    {selectedOrder.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="modal-items-breakdown">
                  <h4>Order Items</h4>
                  {selectedOrder.items.map((li, idx) => (
                    <div className="modal-item-line" key={idx} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <span>
                          <strong>{li.quantity} ×</strong> {li.name}
                          {li.selectedVariant && (
                            <span className="kds-variant-badge" style={{ marginLeft: 6 }}>
                              {li.selectedVariant.name.toUpperCase()}
                            </span>
                          )}
                        </span>
                        <b>{money(li.price * li.quantity)}</b>
                      </div>
                      {Array.isArray(li.selectedModifiers) && li.selectedModifiers.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginLeft: 20 }}>
                          {li.selectedModifiers.map((mod, mIdx) => (
                            <span key={mIdx} className="kds-mod-tag">
                              +{mod.name} (+₹{mod.price})
                            </span>
                          ))}
                        </div>
                      )}
                      {li.notes && (
                        <div style={{ marginLeft: 20, fontSize: 11, fontStyle: 'italic', color: '#176B50' }}>
                          Note: {li.notes}
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedOrder.discountValue > 0 && (
                    <div className="modal-item-line" style={{ color: '#10b981', fontWeight: 600 }}>
                      <span>
                        Discount ({selectedOrder.discountType === 'percent' ? `${selectedOrder.discountValue}%` : `₹${selectedOrder.discountValue}`}
                        {selectedOrder.discountReason ? ` · ${selectedOrder.discountReason}` : ''})
                      </span>
                      <b>- {money(selectedOrder.discount || ((selectedOrder.subtotal || selectedOrder.total) - selectedOrder.total))}</b>
                    </div>
                  )}

                  {Array.isArray(selectedOrder.splitBills) && selectedOrder.splitBills.length > 0 && (
                    <div style={{ marginTop: 10, padding: '10px 12px', background: '#fdfaf6', borderRadius: 8, border: '1px solid #ebd9c8' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#4a3424' }}>
                          Split Bill ({selectedOrder.splitBills.filter(s => s.paymentStatus === 'paid').length}/{selectedOrder.splitBills.length} Settled)
                        </span>
                        <span style={{ fontSize: 11, color: '#777' }}>
                          ₹{(selectedOrder.splitBills[0]?.amount || 0).toLocaleString('en-IN')} / diner
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selectedOrder.splitBills.map((s, sIdx) => (
                          <div
                            key={s.id || sIdx}
                            style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: s.paymentStatus === 'paid' ? '#ecfdf5' : '#fff1f2',
                              color: s.paymentStatus === 'paid' ? '#047857' : '#be123c',
                              border: `1px solid ${s.paymentStatus === 'paid' ? '#a7f3d0' : '#fecdd3'}`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <span>{s.label}: ₹{s.amount}</span>
                            <b>({s.paymentStatus.toUpperCase()})</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="modal-item-line total">
                    <span>Total Amount</span>
                    <b>{money(selectedOrder.total)}</b>
                  </div>
                </div>
              )}

              <div className="modal-actions-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
                <button
                  className="crm-btn-primary"
                  onClick={() => patchOrder(selectedOrder._id, { status: 'completed', paymentStatus: 'paid' })}
                >
                  Mark as Completed (Paid)
                </button>
                {selectedOrder.status !== 'cancelled' && selectedOrder.paymentStatus !== 'paid' && (
                  <>
                    <button
                      className="crm-btn-secondary"
                      onClick={() => {
                        setTransferOrderModal(selectedOrder);
                        setTransferTargetTable(selectedOrder.table || '1');
                      }}
                      title="Transfer Order to Another Table or Takeaway"
                    >
                      <Armchair size={14} style={{ marginRight: 4 }} />
                      Transfer Table
                    </button>
                    <button
                      className="crm-btn-secondary"
                      onClick={() => {
                        setSplitOrderModal(selectedOrder);
                        setSplitDinerCount(selectedOrder.splitBills?.length || 2);
                      }}
                      title="Split Bill Across Multiple Diners"
                    >
                      <Scissors size={14} style={{ marginRight: 4 }} />
                      Split Bill
                    </button>
                    <button
                      className="crm-btn-secondary"
                      onClick={() => {
                        setDiscountOrderModal(selectedOrder);
                        setDiscountTypeInput('percent');
                        setDiscountValueInput(10);
                        setDiscountReasonInput('Happy Hour');
                        setDiscountAuthorizedBy(currentUser?.name || 'Manager');
                      }}
                      title="Apply Percentage, Flat, or Promo Code Discount"
                    >
                      <Percent size={14} style={{ marginRight: 4 }} />
                      Discount / Promo
                    </button>
                  </>
                )}
                <button
                  className="crm-btn-secondary"
                  onClick={() => setThermalReceiptModal({ order: selectedOrder, type: 'kot' })}
                  title="Print Kitchen Order Ticket (KOT)"
                >
                  <Printer size={14} style={{ marginRight: 4 }} />
                  Print KOT
                </button>
                <button
                  className="crm-btn-secondary"
                  onClick={() => setThermalReceiptModal({ order: selectedOrder, type: 'bill' })}
                  title="Print Customer Bill Receipt"
                >
                  <FileText size={14} style={{ marginRight: 4 }} />
                  Print Bill
                </button>
                <button
                  className="crm-btn-secondary"
                  onClick={() => setSelectedOrder(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== CUSTOMER CRM DETAIL DRAWER / MODAL ===================== */}
        {selectedCustomer && (
          <div className="crm-drawer-backdrop" onClick={() => setSelectedCustomer(null)}>
            <div className="crm-drawer-card" onClick={e => e.stopPropagation()}>
              {/* Drawer Top Row */}
              <div className="crm-drawer-header">
                <div className="crm-header-profile-block">
                  <div
                    className="crm-drawer-avatar"
                    style={{
                      backgroundColor: getAvatarColor(selectedCustomer.name?.[0] || 'G').bg,
                      color: getAvatarColor(selectedCustomer.name?.[0] || 'G').text,
                    }}
                  >
                    {selectedCustomer.name?.[0] || 'G'}
                  </div>
                  <div className="crm-header-main-info">
                    <div className="crm-title-row">
                      <h2>{customerDetail?.customer?.name || selectedCustomer.name || 'Valued Guest'}</h2>
                      {(customerDetail?.customer?.totalSpend || selectedCustomer.totalSpend || 0) >= 1000 && (
                        <span className="crm-vip-badge big">⭐ VIP DINER</span>
                      )}
                    </div>
                    <div className="crm-header-contacts">
                      <a href={`tel:${selectedCustomer.phone}`} className="crm-contact-chip phone">
                        <Phone size={12} />
                        <span>{selectedCustomer.phone}</span>
                      </a>
                      <a
                        href={`https://wa.me/91${selectedCustomer.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="crm-contact-chip whatsapp"
                      >
                        <MessageSquare size={12} />
                        <span>WhatsApp</span>
                      </a>
                      <span className="member-since">
                        · Member since {new Date(selectedCustomer.createdAt || Date.now()).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="crm-drawer-close"
                  onClick={() => setSelectedCustomer(null)}
                  title="Close Profile"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Highlights Metric Banner */}
              <div className="crm-highlights-grid">
                <div className="crm-highlight-item">
                  <span className="lbl">Lifetime Spend</span>
                  <b className="val highlight">{money(customerDetail?.customer?.totalSpend ?? selectedCustomer.totalSpend)}</b>
                  <small>Paid orders total</small>
                </div>
                <div className="crm-highlight-item">
                  <span className="lbl">Total Orders</span>
                  <b className="val">{customerDetail?.orders?.length ?? selectedCustomer.ordersCount ?? 0}</b>
                  <small>Dine-in & takeaways</small>
                </div>
                <div className="crm-highlight-item">
                  <span className="lbl">Average Order Value</span>
                  <b className="val">{money(customerDetail?.customer?.averageOrderValue ?? selectedCustomer.averageOrderValue)}</b>
                  <small>Per completed dining</small>
                </div>
                <div className="crm-highlight-item">
                  <span className="lbl">Loyalty Progress</span>
                  <b className="val">
                    {customerDetail?.customer?.visits ?? selectedCustomer.visits ?? 0} / {data.cafe?.loyalty?.visitsRequired || 8}
                  </b>
                  <small>
                    {(customerDetail?.customer?.visits ?? selectedCustomer.visits ?? 0) >= (data.cafe?.loyalty?.visitsRequired || 8)
                      ? 'Reward Unlocked!'
                      : `${Math.max(0, (data.cafe?.loyalty?.visitsRequired || 8) - (customerDetail?.customer?.visits ?? selectedCustomer.visits ?? 0))} visits to next`}
                  </small>
                </div>
              </div>

              {/* Milestone Stamp Track Bar */}
              <div className="crm-progress-track-container">
                <div className="progress-track-info">
                  <span className="track-title">Milestone Stamp Journey</span>
                  <b className="track-percentage">
                    {Math.min(100, Math.round(((customerDetail?.customer?.visits ?? selectedCustomer.visits ?? 0) / (data.cafe?.loyalty?.visitsRequired || 8)) * 100))}% completed
                  </b>
                </div>
                <div className="crm-progress-bar-bg">
                  <div
                    className="crm-progress-bar-fill"
                    style={{
                      width: `${Math.min(100, Math.round(((customerDetail?.customer?.visits ?? selectedCustomer.visits ?? 0) / (data.cafe?.loyalty?.visitsRequired || 8)) * 100))}%`
                    }}
                  ></div>
                </div>
              </div>

              {/* Drawer Tabs Navigation */}
              <div className="crm-drawer-tabs-bar">
                <button
                  type="button"
                  className={`crm-drawer-tab-btn ${customerDrawerTab === 'orders' ? 'active' : ''}`}
                  onClick={() => setCustomerDrawerTab('orders')}
                >
                  <History size={15} />
                  <span>Orders Timeline ({customerDetail?.orders?.length || 0})</span>
                </button>
                <button
                  type="button"
                  className={`crm-drawer-tab-btn ${customerDrawerTab === 'rewards' ? 'active' : ''}`}
                  onClick={() => setCustomerDrawerTab('rewards')}
                >
                  <Gift size={15} />
                  <span>Rewards & Passes ({customerDetail?.rewards?.length || 0})</span>
                </button>
                <button
                  type="button"
                  className={`crm-drawer-tab-btn ${customerDrawerTab === 'notes' ? 'active' : ''}`}
                  onClick={() => setCustomerDrawerTab('notes')}
                >
                  <FileText size={15} />
                  <span>Diner Notes & Preferences</span>
                </button>
              </div>

              {/* Tab 1: Orders Timeline */}
              {customerDrawerTab === 'orders' && (
                <div className="crm-tab-content-scroll">
                  <div className="crm-orders-action-strip">
                    <div className="crm-orders-strip-info">
                      <span className="crm-orders-strip-title">Dining & Orders History</span>
                      <small className="crm-orders-strip-sub">
                        {customerDetail?.orders?.length || 0} order(s) recorded for {customerDetail?.customer?.name || selectedCustomer?.name}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="crm-add-order-btn"
                      onClick={() => openManualOrderModal(selectedCustomer)}
                    >
                      <Plus size={14} />
                      <span>+ Create Order for Diner</span>
                    </button>
                  </div>

                  {loadingCustomerDetail ? (
                    <div className="crm-loading-state">
                      <RefreshCw size={24} className="spin" />
                      <span>Loading complete order timeline…</span>
                    </div>
                  ) : !customerDetail?.orders || customerDetail.orders.length === 0 ? (
                    <div className="crm-empty-state">
                      <ShoppingBag size={36} />
                      <h4>No orders recorded yet</h4>
                      <p>Orders placed in-store or online will appear here chronologically.</p>
                      <button
                        type="button"
                        className="crm-add-order-btn primary"
                        style={{ marginTop: '12px' }}
                        onClick={() => openManualOrderModal(selectedCustomer)}
                      >
                        <Plus size={14} />
                        <span>Place First Order for Diner</span>
                      </button>
                    </div>
                  ) : (
                    <div className="crm-orders-timeline-list">
                      {customerDetail.orders.map(order => {
                        const channelLabel = order.table
                          ? (order.table.toString().toLowerCase().includes('table') ? order.table : `Table #${order.table}`)
                          : 'Counter / Takeaway';
                        const paymentLabel = order.paymentMethod === 'demo_online' ? 'Online UPI' : 'Counter Cash';

                        return (
                          <div key={order._id || order.orderNo} className="crm-timeline-order-card">
                            <div className="timeline-order-header">
                              <div className="timeline-order-title-box">
                                <span className="timeline-order-no">{order.orderNo}</span>
                                <span className="timeline-order-date">
                                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <div className="timeline-badges-row">
                                <span className={`status-pill payment ${order.paymentStatus}`}>
                                  {order.paymentStatus?.toUpperCase()}
                                </span>
                                <span className={`status-pill order-state ${order.status}`}>
                                  {order.status?.toUpperCase()}
                                </span>
                              </div>
                            </div>

                            <div className="timeline-order-channel">
                              <span className="order-meta-pill">
                                <Utensils size={12} />
                                <span>Channel: <b>{channelLabel}</b></span>
                              </span>
                              <span className="order-meta-pill">
                                <Coins size={12} />
                                <span>Payment: <b>{paymentLabel}</b></span>
                              </span>
                            </div>

                            {order.items && order.items.length > 0 && (
                              <div className="timeline-items-list">
                                {order.items.map((li, idx) => (
                                  <div key={idx} className="timeline-item-row">
                                    <span className="timeline-item-name">{li.quantity} × {li.name}</span>
                                    <b className="timeline-item-price">{money(li.price * li.quantity)}</b>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="timeline-order-bill-summary">
                              {order.discount > 0 && (
                                <div className="timeline-discount-row">
                                  <span>Milestone Voucher:</span>
                                  <b>-{money(order.discount)}</b>
                                </div>
                              )}
                              <div className="timeline-total-row">
                                <span>Bill Total:</span>
                                <b>{money(order.total)}</b>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Rewards & Passes */}
              {customerDrawerTab === 'rewards' && (
                <div className="crm-tab-content-scroll">
                  <div className="crm-orders-action-strip">
                    <div className="crm-orders-strip-info">
                      <span className="crm-orders-strip-title">Customer Rewards & Vouchers</span>
                      <small className="crm-orders-strip-sub">
                        {customerDetail?.rewards?.length || 0} total voucher(s) • {(customerDetail?.rewards || []).filter(r => (r.status === 'available' || r.status === 'claimed') && (!r.expiresAt || new Date(r.expiresAt) > new Date())).length} ready to redeem
                      </small>
                    </div>
                    {(isOwner || isManager || isCashier) && (
                      <button
                        type="button"
                        className="crm-add-order-btn"
                        onClick={() => {
                          setVoucherAmount(250);
                          setVoucherValidityDays(30);
                          setVoucherReason('Birthday Perk');
                          setVoucherCustomReason('');
                          setIssueVoucherModalOpen(true);
                        }}
                      >
                        <Plus size={14} />
                        <span>+ Issue Voucher</span>
                      </button>
                    )}
                  </div>

                  {voucherSuccessToast && (
                    <div className="crm-voucher-success-toast">
                      <CheckCircle2 size={16} color="#16a34a" />
                      <span>{voucherSuccessToast}</span>
                    </div>
                  )}

                  {loadingCustomerDetail ? (
                    <div className="crm-loading-state">
                      <RefreshCw size={24} className="spin" />
                      <span>Loading reward vouchers…</span>
                    </div>
                  ) : !customerDetail?.rewards || customerDetail.rewards.length === 0 ? (
                    <div className="crm-empty-state">
                      <Gift size={36} />
                      <h4>No vouchers unlocked yet</h4>
                      <p>Vouchers earned via loyalty stamp milestones or issued manually will appear here.</p>
                      {(isOwner || isManager || isCashier) && (
                        <button
                          type="button"
                          className="crm-btn-primary"
                          style={{ marginTop: 14 }}
                          onClick={() => {
                            setVoucherAmount(250);
                            setVoucherValidityDays(30);
                            setVoucherReason('Birthday Perk');
                            setVoucherCustomReason('');
                            setIssueVoucherModalOpen(true);
                          }}
                        >
                          <Plus size={15} />
                          <span>Issue First Voucher</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="crm-rewards-timeline-list">
                      {customerDetail.rewards.map(reward => (
                        <div key={reward._id || reward.id} className="crm-reward-card">
                          <div className="crm-reward-card-top">
                            <div className="crm-reward-title-group">
                              <span className="reward-val-title">{money(reward.amount)} Dining Voucher</span>
                              {reward.claimCode && (
                                <span className="claim-code-pill-sm">{reward.claimCode}</span>
                              )}
                            </div>
                            <span className={`status-pill ${reward.status === 'redeemed' ? 'order-state completed' : reward.status === 'claimed' ? 'loyalty-member ready' : reward.status === 'expired' ? 'payment failed' : 'loyalty-member in-progress'}`}>
                              {reward.status?.toUpperCase()}
                            </span>
                          </div>

                          <div className="crm-reward-meta-grid">
                            <div className="meta-box">
                              <small>Unlocked On</small>
                              <span>{new Date(reward.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                            {reward.claimedAt && (
                              <div className="meta-box">
                                <small>Claimed Pass</small>
                                <span>{new Date(reward.claimedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              </div>
                            )}
                            {reward.redeemedAt && (
                              <div className="meta-box">
                                <small>Redeemed At Counter</small>
                                <span>{new Date(reward.redeemedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              </div>
                            )}
                            {reward.expiresAt && (
                              <div className="meta-box">
                                <small>Expires</small>
                                <span>{new Date(reward.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              </div>
                            )}
                          </div>

                          {reward.notes && (
                            <div className="reward-cashier-notes">
                              <small>Staff Note:</small> <span>{reward.notes}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Notes & Diner Preferences */}
              {customerDrawerTab === 'notes' && (
                <div className="crm-tab-content-scroll">
                  <form onSubmit={handleSaveCustomerProfile} className="crm-notes-form">
                    <div className="form-group">
                      <label>Diner Email Address</label>
                      <input
                        type="email"
                        placeholder="e.g. diner@example.com"
                        value={customerEmailInput}
                        onChange={e => setCustomerEmailInput(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Staff Notes & Preferences</label>
                      <textarea
                        rows={4}
                        placeholder="e.g. Prefers oat milk cappuccino, favorite table by the window, VIP regular diner..."
                        value={customerNotesInput}
                        onChange={e => setCustomerNotesInput(e.target.value)}
                      />
                      <small className="form-helper-text">
                        These notes are visible to café owners and floor staff when inspecting this customer's profile.
                      </small>
                    </div>

                    <button
                      type="submit"
                      className="crm-btn-primary"
                      disabled={savingCustomerProfile}
                    >
                      <Check size={16} />
                      <span>{savingCustomerProfile ? 'Saving…' : 'Save Diner Preferences'}</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== MANUAL ORDER CREATION MODAL (CRM & POS) ===================== */}
        {manualOrderModalOpen && (
          <div className="crm-drawer-backdrop" onClick={() => setManualOrderModalOpen(false)}>
            <div className="crm-manual-order-modal" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="crm-modal-header">
                <div>
                  <div className="crm-modal-badge-row">
                    <span className="crm-modal-badge">CRM & Staff POS</span>
                    {manualOrderDiner && (
                      <span className="crm-modal-diner-badge">
                        <Users size={12} /> Existing Diner: {manualOrderDiner.name}
                      </span>
                    )}
                  </div>
                  <h2 className="crm-modal-title">Create Manual Order</h2>
                  <p className="crm-modal-sub">
                    Directly enter customer dining, takeaway, or phone orders with live inventory & loyalty sync
                  </p>
                </div>
                <button
                  type="button"
                  className="crm-drawer-close"
                  onClick={() => setManualOrderModalOpen(false)}
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Main Two-Column Split Layout */}
              <div className="crm-modal-body-grid">
                {/* Left Column: Customer & Service Setup */}
                <div className="crm-modal-left-col">
                  {/* Customer Information Card */}
                  <div className="crm-section-card">
                    <h4 className="crm-section-title">
                      <User size={15} />
                      <span>Customer & Loyalty Info</span>
                    </h4>

                    <div className="crm-form-fields-grid">
                      <div className="form-group">
                        <label>Customer Name <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Rahul Sharma"
                          value={manualOrderName}
                          onChange={e => setManualOrderName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>10-Digit Mobile <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                        <input
                          type="tel"
                          required
                          placeholder="9876543210"
                          maxLength={10}
                          value={manualOrderPhone}
                          onChange={e => setManualOrderPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        />
                      </div>
                    </div>

                    {/* Loyalty Voucher Discount Selector */}
                    {selectedDinerRewards.length > 0 && (
                      <div className="crm-loyalty-rewards-box">
                        <div className="crm-loyalty-rewards-header">
                          <Gift size={15} color="#176B50" />
                          <strong>Available Loyalty Perk ({selectedDinerRewards.length})</strong>
                        </div>
                        <select
                          value={manualOrderRewardId}
                          onChange={e => setManualOrderRewardId(e.target.value)}
                          className="crm-reward-select"
                        >
                          <option value="">No reward discount applied</option>
                          {selectedDinerRewards.map(r => (
                            <option key={r.id || r._id} value={r.id || r._id}>
                              ₹{r.amount} Discount Voucher ({r.claimCode})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Channel & Table Card */}
                  <div className="crm-section-card">
                    <h4 className="crm-section-title">
                      <Armchair size={15} />
                      <span>Service Channel & Table</span>
                    </h4>

                    <div className="crm-form-fields-grid">
                      <div className="form-group">
                        <label>Table / Station</label>
                        <select
                          value={manualOrderTable}
                          onChange={e => setManualOrderTable(e.target.value)}
                        >
                          <option value="Counter / Takeaway">Counter / Takeaway</option>
                          <option value="Delivery / Online Pickup">Delivery / Online Pickup</option>
                          {(tablesList || []).map(t => (
                            <option key={t.id || t.tableNumber} value={`Table #${t.tableNumber}`}>
                              Table #{t.tableNumber} ({t.section || 'Floor'}, {t.capacity}p)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Order Workflow State</label>
                        <select
                          value={manualOrderStatus}
                          onChange={e => setManualOrderStatus(e.target.value)}
                        >
                          <option value="placed">Placed (Send to Kitchen KDS)</option>
                          <option value="preparing">Preparing (In Kitchen)</option>
                          <option value="ready">Ready for Pickup / Serve</option>
                          <option value="completed">Completed (Immediate Delivery)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Payment Setup Card */}
                  <div className="crm-section-card">
                    <h4 className="crm-section-title">
                      <CreditCard size={15} />
                      <span>Payment Method & Settlement</span>
                    </h4>

                    <div className="crm-form-fields-grid">
                      <div className="form-group">
                        <label>Payment Mode</label>
                        <div className="crm-method-pills">
                          <button
                            type="button"
                            className={`crm-method-pill ${manualOrderPaymentMethod === 'cash' ? 'active' : ''}`}
                            onClick={() => setManualOrderPaymentMethod('cash')}
                          >
                            <Coins size={13} />
                            <span>Cash / Counter</span>
                          </button>
                          <button
                            type="button"
                            className={`crm-method-pill ${manualOrderPaymentMethod === 'demo_online' ? 'active' : ''}`}
                            onClick={() => setManualOrderPaymentMethod('demo_online')}
                          >
                            <CreditCard size={13} />
                            <span>Online UPI / Card</span>
                          </button>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Settlement Status</label>
                        <div className="crm-method-pills">
                          <button
                            type="button"
                            className={`crm-method-pill ${manualOrderPaymentStatus === 'paid' ? 'active' : ''}`}
                            onClick={() => setManualOrderPaymentStatus('paid')}
                          >
                            <Check size={13} />
                            <span>Paid</span>
                          </button>
                          <button
                            type="button"
                            className={`crm-method-pill ${manualOrderPaymentStatus === 'pending' ? 'active' : ''}`}
                            onClick={() => setManualOrderPaymentStatus('pending')}
                          >
                            <Clock size={13} />
                            <span>Pending</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: '10px' }}>
                      <label>Special Instructions / Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Less sugar, oat milk, spicy..."
                        value={manualOrderNotes}
                        onChange={e => setManualOrderNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Menu Item Catalog & Order Cart */}
                <div className="crm-modal-right-col">
                  {/* Item Picker Header */}
                  <div className="crm-items-picker-card">
                    <div className="crm-items-picker-header">
                      <h4 className="crm-section-title" style={{ margin: 0 }}>
                        <Utensils size={15} />
                        <span>Select Menu Items</span>
                      </h4>
                      <div className="crm-menu-search">
                        <Search size={14} />
                        <input
                          type="text"
                          placeholder="Search menu..."
                          value={manualOrderSearch}
                          onChange={e => setManualOrderSearch(e.target.value)}
                        />
                        {manualOrderSearch && (
                          <button type="button" onClick={() => setManualOrderSearch('')}>
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="crm-menu-category-pills">
                      {availableManualMenuCategories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          className={`crm-menu-cat-pill ${manualOrderCategory === cat ? 'active' : ''}`}
                          onClick={() => setManualOrderCategory(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Menu Item Grid */}
                    <div className="crm-menu-items-scroll">
                      {filteredManualMenuItems.length === 0 ? (
                        <div className="crm-menu-empty">
                          <p>No menu items found.</p>
                        </div>
                      ) : (
                        filteredManualMenuItems.map(item => {
                          const hasCustoms = (Array.isArray(item.variants) && item.variants.length > 0) || (Array.isArray(item.modifierGroups) && item.modifierGroups.length > 0);
                          const matchingItems = manualOrderItems.filter(i => i.menuItemId === (item.id || item._id));
                          const totalQtyInCart = matchingItems.reduce((s, i) => s + (i.quantity || 1), 0);

                          return (
                            <div key={item.id || item._id} className="crm-menu-pick-item">
                              <div className="crm-pick-left">
                                <span className={`crm-veg-dot ${item.veg ? 'veg' : 'non-veg'}`}></span>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <strong className="crm-pick-name">{item.name}</strong>
                                    {hasCustoms && (
                                      <span className="brix-card-custom-badge" style={{ fontSize: 9, padding: '1px 5px' }}>Customisable</span>
                                    )}
                                  </div>
                                  <span className="crm-pick-price">
                                    {hasCustoms ? `From ₹${Number(item.price).toLocaleString('en-IN')}` : `₹${Number(item.price).toLocaleString('en-IN')}`}
                                  </span>
                                </div>
                              </div>
                              {hasCustoms ? (
                                <button
                                  type="button"
                                  className="crm-pick-add-btn"
                                  style={{ background: totalQtyInCart > 0 ? '#3c291d' : undefined, color: totalQtyInCart > 0 ? '#f7eee7' : undefined }}
                                  onClick={() => addItemToManualOrder(item)}
                                >
                                  <Plus size={13} />
                                  <span>{totalQtyInCart > 0 ? `Add (${totalQtyInCart})` : 'Customise'}</span>
                                </button>
                              ) : totalQtyInCart > 0 ? (
                                <div className="crm-qty-counter">
                                  <button
                                    type="button"
                                    onClick={() => updateManualOrderItemQty(matchingItems[0]?.lineId || item.id || item._id, -1)}
                                  >
                                    -
                                  </button>
                                  <span>{totalQtyInCart}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateManualOrderItemQty(matchingItems[0]?.lineId || item.id || item._id, 1)}
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="crm-pick-add-btn"
                                  onClick={() => addItemToManualOrder(item)}
                                >
                                  <Plus size={13} />
                                  <span>Add</span>
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Order Cart & Billing Summary */}
                  <div className="crm-cart-summary-card">
                    <div className="crm-cart-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShoppingCart size={15} />
                        <strong style={{ fontSize: '13px' }}>Order Cart ({manualOrderItems.length} items)</strong>
                      </div>
                      {manualOrderItems.length > 0 && (
                        <button
                          type="button"
                          className="crm-clear-cart-link"
                          onClick={() => setManualOrderItems([])}
                        >
                          Clear Cart
                        </button>
                      )}
                    </div>

                    <div className="crm-cart-items-list">
                      {manualOrderItems.length === 0 ? (
                        <div className="crm-cart-empty">
                          <ShoppingBag size={24} />
                          <span>No items selected yet. Tap "+ Add" on items above.</span>
                        </div>
                      ) : (
                        manualOrderItems.map(item => (
                          <div key={item.lineId || item.menuItemId} className="crm-cart-item-row">
                            <div className="crm-cart-item-info">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span className="crm-cart-item-name">{item.name}</span>
                                {item.selectedVariant && (
                                  <span className="kds-variant-badge" style={{ fontSize: 10, padding: '1px 5px' }}>
                                    {item.selectedVariant.name.toUpperCase()}
                                  </span>
                                )}
                              </div>
                              {Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                                  {item.selectedModifiers.map((mod, mIdx) => (
                                    <span key={mIdx} className="kds-mod-tag" style={{ fontSize: 10, padding: '1px 5px' }}>
                                      +{mod.name} (+₹{mod.price})
                                    </span>
                                  ))}
                                </div>
                              )}
                              {item.notes && (
                                <div style={{ fontSize: 11, fontStyle: 'italic', color: '#176B50', marginTop: 2 }}>
                                  Note: {item.notes}
                                </div>
                              )}
                              <span className="crm-cart-item-calc">
                                ₹{item.price} × {item.quantity} = ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="crm-cart-actions">
                              <div className="crm-qty-counter mini">
                                <button type="button" onClick={() => updateManualOrderItemQty(item.lineId || item.menuItemId, -1)}>-</button>
                                <span>{item.quantity}</span>
                                <button type="button" onClick={() => updateManualOrderItemQty(item.lineId || item.menuItemId, 1)}>+</button>
                              </div>
                              <button
                                type="button"
                                className="crm-cart-trash-btn"
                                onClick={() => removeManualOrderItem(item.lineId || item.menuItemId)}
                                title="Remove item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Totals Breakdown */}
                    <div className="crm-cart-totals-box">
                      <div className="crm-total-line">
                        <span>Subtotal</span>
                        <b>₹{manualSubtotal.toLocaleString('en-IN')}</b>
                      </div>
                      {manualDiscount > 0 && (
                        <div className="crm-total-line discount">
                          <span>Loyalty Perk Discount</span>
                          <b>- ₹{manualDiscount.toLocaleString('en-IN')}</b>
                        </div>
                      )}
                      <div className="crm-total-line net">
                        <span>Total Payable</span>
                        <b className="net-amount">₹{manualTotal.toLocaleString('en-IN')}</b>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="crm-modal-footer">
                <button
                  type="button"
                  className="crm-modal-cancel-btn"
                  onClick={() => setManualOrderModalOpen(false)}
                  disabled={submittingManualOrder}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="crm-modal-submit-btn"
                  onClick={handleSubmitManualOrder}
                  disabled={submittingManualOrder || manualOrderItems.length === 0}
                >
                  {submittingManualOrder ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Creating Order…</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Create & Dispatch Order (₹{manualTotal.toLocaleString('en-IN')})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== CRM ISSUE CUSTOM VOUCHER MODAL ===================== */}
        {issueVoucherModalOpen && selectedCustomer && (
          <div className="crm-modal-backdrop" onClick={() => setIssueVoucherModalOpen(false)}>
            <div className="crm-modal-card" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="crm-modal-header">
                <div className="crm-modal-header-left">
                  <div className="crm-modal-icon-badge" style={{ background: '#F1F7F2', color: '#176B50' }}>
                    <Gift size={20} />
                  </div>
                  <div>
                    <h3 className="crm-modal-title">Issue Dining Voucher</h3>
                    <p className="crm-modal-subtitle">
                      Credit a redeemable discount voucher to {customerDetail?.customer?.name || selectedCustomer?.name} ({customerDetail?.customer?.phone || selectedCustomer?.phone})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="crm-modal-close-btn"
                  onClick={() => setIssueVoucherModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleIssueCustomVoucher}>
                <div className="crm-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 'calc(85vh - 140px)', overflowY: 'auto', padding: 22 }}>
                  {/* Preset Amount Chips */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                      Voucher Discount Amount (₹) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      {[100, 250, 500, 1000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          className={`crm-quick-step-btn ${voucherAmount === amt ? 'active' : ''}`}
                          style={{
                            padding: '7px 14px',
                            borderRadius: 8,
                            fontSize: '12.5px',
                            fontWeight: 700,
                            border: voucherAmount === amt ? '1.5px solid #176B50' : '1px solid #e5e7eb',
                            background: voucherAmount === amt ? '#F1F7F2' : '#ffffff',
                            color: voucherAmount === amt ? '#176B50' : '#374151',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onClick={() => setVoucherAmount(amt)}
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#6b7280', fontSize: '15px' }}>
                        ₹
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="50000"
                        required
                        value={voucherAmount}
                        onChange={e => setVoucherAmount(Math.max(1, parseInt(e.target.value, 10) || ''))}
                        placeholder="e.g. 250"
                        style={{
                          width: '100%',
                          padding: '10px 14px 10px 30px',
                          border: '1.5px solid #d1d5db',
                          borderRadius: 10,
                          fontSize: '15px',
                          fontWeight: 700,
                          color: '#111827',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <small style={{ fontSize: '11px', color: '#6b7280', marginTop: 4, display: 'block' }}>
                      Directly deducted from total bill upon redemption at counter or checkout.
                    </small>
                  </div>

                  {/* Validity Window */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                      Voucher Validity Period
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      {[
                        { label: '7 Days', days: 7 },
                        { label: '15 Days', days: 15 },
                        { label: '30 Days', days: 30 },
                        { label: '60 Days', days: 60 },
                        { label: '90 Days', days: 90 },
                      ].map(opt => (
                        <button
                          key={opt.days}
                          type="button"
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: '12px',
                            fontWeight: 600,
                            border: voucherValidityDays === opt.days ? '1.5px solid #176B50' : '1px solid #e5e7eb',
                            background: voucherValidityDays === opt.days ? '#F1F7F2' : '#ffffff',
                            color: voucherValidityDays === opt.days ? '#176B50' : '#4b5563',
                            cursor: 'pointer'
                          }}
                          onClick={() => setVoucherValidityDays(opt.days)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <small style={{ fontSize: '11px', color: '#6b7280' }}>
                      Expires on: <b>{new Date(Date.now() + (Number(voucherValidityDays) || 30) * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
                    </small>
                  </div>

                  {/* Reason & Staff Note */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                      Purpose / Courtesy Reason
                    </label>
                    <select
                      value={voucherReason}
                      onChange={e => setVoucherReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: '1.5px solid #d1d5db',
                        borderRadius: 10,
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#1f2937',
                        background: '#ffffff',
                        outline: 'none',
                        marginBottom: voucherReason === 'Custom' ? 8 : 0
                      }}
                    >
                      <option value="Birthday Perk">Birthday Perk / Celebration</option>
                      <option value="Service Recovery / Apology">Service Recovery / Apology (Food/Delay)</option>
                      <option value="VIP Guest Courtesy">VIP Guest Courtesy / Regular Dining Perk</option>
                      <option value="Festival / Seasonal Gift">Festival / Seasonal Special Gift</option>
                      <option value="Influencer / Tasting Courtesy">Influencer / Food Tasting Courtesy</option>
                      <option value="Custom">Custom Staff Note…</option>
                    </select>

                    {voucherReason === 'Custom' && (
                      <input
                        type="text"
                        placeholder="e.g. Compensation for spilled coffee on table #2"
                        value={voucherCustomReason}
                        onChange={e => setVoucherCustomReason(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          border: '1.5px solid #d1d5db',
                          borderRadius: 8,
                          fontSize: '12.5px',
                          outline: 'none'
                        }}
                      />
                    )}
                  </div>

                  {/* Summary Preview Box */}
                  <div style={{ background: '#fdfbf7', border: '1.5px solid #fed7aa', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, color: '#9a3412' }}>
                        Voucher Pass Preview
                      </span>
                      <span className="claim-code-pill-sm">Auto CLM-XXXXX</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#176B50' }}>
                          ₹{Number(voucherAmount || 0).toLocaleString('en-IN')} Dining Voucher
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: 2 }}>
                          {voucherReason === 'Custom' ? (voucherCustomReason || 'Custom Voucher') : voucherReason}
                        </div>
                      </div>
                      <span className="status-pill loyalty-member ready" style={{ fontSize: '11px' }}>
                        READY TO USE
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="crm-modal-footer">
                  <button
                    type="button"
                    className="crm-modal-cancel-btn"
                    onClick={() => setIssueVoucherModalOpen(false)}
                    disabled={submittingVoucher}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="crm-btn-primary"
                    disabled={submittingVoucher || !voucherAmount || voucherAmount <= 0}
                    style={{
                      padding: '10px 22px',
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: '13.5px',
                      cursor: 'pointer'
                    }}
                  >
                    {submittingVoucher ? (
                      <>
                        <RefreshCw size={15} className="spin" />
                        <span>Issuing Voucher…</span>
                      </>
                    ) : (
                      <>
                        <Gift size={16} />
                        <span>Credit Voucher (₹{Number(voucherAmount || 0).toLocaleString('en-IN')})</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================== POS RAPID ITEM CUSTOMIZER MODAL ===================== */}
        {posCustomizingItem && (
          <div className="customizer-modal-backdrop" onClick={() => setPosCustomizingItem(null)} style={{ zIndex: 11000 }}>
            <div className="customizer-modal-card" onClick={e => e.stopPropagation()}>
              <div className="customizer-modal-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={`crm-veg-dot ${posCustomizingItem.veg ? 'veg' : 'non-veg'}`}></span>
                    <h3 className="customizer-modal-title">{posCustomizingItem.name}</h3>
                  </div>
                  <span className="customizer-modal-subtitle">
                    Base: ₹{posSelectedVariant ? Number(posSelectedVariant.price).toLocaleString('en-IN') : Number(posCustomizingItem.price).toLocaleString('en-IN')}
                  </span>
                </div>
                <button
                  type="button"
                  className="customizer-close-btn"
                  onClick={() => setPosCustomizingItem(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="customizer-modal-body">
                {/* Variant Selector */}
                {Array.isArray(posCustomizingItem.variants) && posCustomizingItem.variants.length > 0 && (
                  <div className="customizer-group-block">
                    <div className="customizer-group-header">
                      <h4 className="customizer-group-title">Select Size / Portion</h4>
                      <span className="customizer-group-badge required">Required</span>
                    </div>
                    <div className="customizer-variant-grid">
                      {posCustomizingItem.variants.map(v => {
                        const isSelected = posSelectedVariant?.id === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            className={`customizer-variant-btn ${isSelected ? 'active' : ''}`}
                            onClick={() => setPosSelectedVariant(v)}
                          >
                            <span className="variant-name">{v.name}</span>
                            <span className="variant-price">₹{Number(v.price).toLocaleString('en-IN')}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Modifier Groups */}
                {Array.isArray(posCustomizingItem.modifierGroups) && posCustomizingItem.modifierGroups.map(grp => {
                  const isMulti = (grp.maxSelections || 1) > 1;
                  return (
                    <div key={grp.id} className="customizer-group-block">
                      <div className="customizer-group-header">
                        <h4 className="customizer-group-title">{grp.name}</h4>
                        <span className={`customizer-group-badge ${grp.required ? 'required' : 'optional'}`}>
                          {grp.required ? (isMulti ? `Choose up to ${grp.maxSelections}` : 'Required') : 'Optional'}
                        </span>
                      </div>
                      <div className="customizer-options-list">
                        {(grp.options || []).map(opt => {
                          const isChecked = posSelectedModifiers.some(
                            m => m.groupId === grp.id && m.optionId === opt.id
                          );
                          return (
                            <label key={opt.id} className={`customizer-option-row ${isChecked ? 'selected' : ''}`}>
                              <input
                                type={isMulti ? 'checkbox' : 'radio'}
                                name={`pos-mod-${grp.id}`}
                                checked={isChecked}
                                onChange={() => {
                                  if (isMulti) {
                                    if (isChecked) {
                                      setPosSelectedModifiers(prev =>
                                        prev.filter(m => !(m.groupId === grp.id && m.optionId === opt.id))
                                      );
                                    } else {
                                      const curCount = posSelectedModifiers.filter(m => m.groupId === grp.id).length;
                                      if (curCount < (grp.maxSelections || 1)) {
                                        setPosSelectedModifiers(prev => [
                                          ...prev,
                                          { groupId: grp.id, optionId: opt.id, name: opt.name, price: Number(opt.price) || 0 }
                                        ]);
                                      }
                                    }
                                  } else {
                                    setPosSelectedModifiers(prev => [
                                      ...prev.filter(m => m.groupId !== grp.id),
                                      { groupId: grp.id, optionId: opt.id, name: opt.name, price: Number(opt.price) || 0 }
                                    ]);
                                  }
                                }}
                              />
                              <span className="opt-name">{opt.name}</span>
                              <span className="opt-price">{Number(opt.price) > 0 ? `+₹${opt.price}` : 'Free'}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Cook / Barista Note */}
                <div className="customizer-group-block">
                  <div className="customizer-group-header">
                    <h4 className="customizer-group-title">Prep & Cooking Instructions</h4>
                    <span className="customizer-group-badge optional">Optional</span>
                  </div>
                  <input
                    type="text"
                    className="customizer-notes-input"
                    placeholder="e.g., Extra hot, oat milk froth, less ice, spicy..."
                    value={posItemNotes}
                    onChange={e => setPosItemNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="customizer-modal-footer">
                <div className="customizer-price-tally">
                  <span className="tally-label">Total Unit Price</span>
                  <span className="tally-amount">
                    ₹{(
                      (posSelectedVariant ? Number(posSelectedVariant.price) : Number(posCustomizingItem.price) || 0) +
                      (posSelectedModifiers || []).reduce((s, m) => s + (Number(m.price) || 0), 0)
                    ).toLocaleString('en-IN')}
                  </span>
                </div>
                <button
                  type="button"
                  className="customizer-submit-btn"
                  onClick={confirmPosCustomizedItem}
                >
                  <Plus size={16} />
                  <span>Add to Order</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== THERMAL RECEIPT / KOT MODAL ===================== */}
        {thermalReceiptModal && (
          <div className="kot-receipt-preview-modal-backdrop" onClick={() => setThermalReceiptModal(null)} style={{ zIndex: 11000 }}>
            <div className="kot-receipt-preview-card" onClick={e => e.stopPropagation()}>
              <div className="kot-preview-header">
                <div className="kot-preview-title">
                  <Printer size={16} />
                  <span>{thermalReceiptModal.type === 'kot' ? 'Thermal Kitchen Order Ticket (KOT)' : 'Thermal Guest Tax Bill'}</span>
                </div>
                <button
                  className="customizer-close-btn"
                  onClick={() => setThermalReceiptModal(null)}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* 80mm ESC/POS Layout */}
              <div className="kot-thermal-receipt">
                <div className="kot-head-brand">
                  <h2 className="kot-cafe-name">{data?.cafe?.name || 'GUSSTORA ARTISAN ROASTERY'}</h2>
                  <div style={{ fontSize: 11, color: '#444', marginBottom: 4 }}>
                    {data?.cafe?.tagline || 'Craft Coffee & Artisanal Kitchen'}
                  </div>
                  <div className="kot-doc-type">
                    {thermalReceiptModal.type === 'kot' ? '*** KITCHEN ORDER TICKET (KOT) ***' : '*** GUEST TAX INVOICE ***'}
                  </div>
                </div>

                <table className="kot-meta-table">
                  <tbody>
                    <tr>
                      <td><strong>{thermalReceiptModal.type === 'kot' ? 'KOT TOKEN:' : 'BILL / ORDER:'}</strong></td>
                      <td className="td-right"><strong>#{thermalReceiptModal.order.orderNo}</strong></td>
                    </tr>
                    <tr>
                      <td><strong>TABLE / CHANNEL:</strong></td>
                      <td className="td-right">{thermalReceiptModal.order.table || 'Counter / Takeaway'}</td>
                    </tr>
                    <tr>
                      <td><strong>GUEST NAME:</strong></td>
                      <td className="td-right">{thermalReceiptModal.order.customerName || 'Walk-in Guest'}</td>
                    </tr>
                    {thermalReceiptModal.order.phone && (
                      <tr>
                        <td><strong>CONTACT:</strong></td>
                        <td className="td-right">{thermalReceiptModal.order.phone}</td>
                      </tr>
                    )}
                    <tr>
                      <td><strong>DATE & TIME:</strong></td>
                      <td className="td-right">
                        {new Date(thermalReceiptModal.order.createdAt || Date.now()).toLocaleDateString('en-IN')}{' '}
                        {new Date(thermalReceiptModal.order.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                    {thermalReceiptModal.type === 'bill' && (
                      <tr>
                        <td><strong>PAYMENT:</strong></td>
                        <td className="td-right">
                          {(thermalReceiptModal.order.paymentStatus || 'PAID').toUpperCase()} via {(thermalReceiptModal.order.paymentMethod || 'CASH').toUpperCase()}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <table className="kot-items-table">
                  <thead>
                    <tr>
                      <th className="th-qty">QTY</th>
                      <th>ITEM DESCRIPTION</th>
                      {thermalReceiptModal.type === 'bill' && <th style={{ textAlign: 'right' }}>AMOUNT</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(thermalReceiptModal.order.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>{it.quantity}x</td>
                        <td>
                          <div className="kot-line-name">{it.name}</div>
                          {it.selectedVariant && (
                            <div className="kot-line-variant">[{it.selectedVariant.name.toUpperCase()}]</div>
                          )}
                          {Array.isArray(it.selectedModifiers) && it.selectedModifiers.length > 0 && (
                            it.selectedModifiers.map((m, mIdx) => (
                              <div key={mIdx} className="kot-line-mod">» {m.name}</div>
                            ))
                          )}
                          {it.notes && (
                            <div className="kot-line-note">COOK NOTE: {it.notes}</div>
                          )}
                        </td>
                        {thermalReceiptModal.type === 'bill' && (
                          <td style={{ textAlign: 'right', verticalAlign: 'top', fontWeight: 'bold' }}>
                            ₹{((Number(it.price) || 0) * (Number(it.quantity) || 1)).toLocaleString('en-IN')}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {thermalReceiptModal.type === 'bill' && (
                  <div style={{ borderBottom: '1px dashed #444', paddingBottom: 6, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span>Subtotal</span>
                      <b>₹{(thermalReceiptModal.order.subtotal || thermalReceiptModal.order.total || 0).toLocaleString('en-IN')}</b>
                    </div>
                    {(Number(thermalReceiptModal.order.discount) > 0) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span>Loyalty Discount</span>
                        <b>- ₹{Number(thermalReceiptModal.order.discount).toLocaleString('en-IN')}</b>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid #111', marginTop: 4, fontSize: 15, fontWeight: 900 }}>
                      <span>GRAND TOTAL</span>
                      <span>₹{(thermalReceiptModal.order.total || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}

                <div className="kot-receipt-footer">
                  <div>TOTAL ITEMS: {(thermalReceiptModal.order.items || []).reduce((s, i) => s + (i.quantity || 1), 0)}</div>
                  {thermalReceiptModal.type === 'bill' ? (
                    <div style={{ marginTop: 6, fontStyle: 'italic' }}>
                      *** THANK YOU FOR DINING WITH US! ***<br />
                      Visit Again Soon!
                    </div>
                  ) : (
                    <div style={{ marginTop: 4 }}>Punched via Gusstora POS Core</div>
                  )}
                </div>
              </div>

              <div className="kot-actions-bar">
                <button
                  type="button"
                  className="kot-print-btn"
                  onClick={() => window.print()}
                >
                  <Printer size={15} />
                  <span>Print Physical (ESC/POS)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== ADD STAFF MODAL ===================== */}
        {showAddStaffModal && (
          <div className="modal-backdrop" onClick={() => setShowAddStaffModal(false)}>
            <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="modal-top-row">
                <div>
                  <span className="modal-order-tag">Team Management</span>
                  <h2 className="modal-order-num" style={{ fontSize: '20px' }}>Add Team Member</h2>
                </div>
                <button
                  type="button"
                  className="modal-close-icon"
                  onClick={() => setShowAddStaffModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} /> Full Name <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={staffForm.name}
                    onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={14} /> Email Address <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. priya@cafe.com"
                    value={staffForm.email}
                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={14} /> Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={staffForm.phone}
                    onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={14} /> Temporary Password <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={staffForm.password}
                    onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
                    The staff member will use this password along with their email to log in to the dashboard.
                  </small>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={14} /> Assign Role <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <select
                    value={staffForm.role}
                    onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    {isOwner && <option value="manager">Manager (Operations, Menu, CRM & Staff)</option>}
                    <option value="cashier">Cashier (POS Orders, Tables & Redemptions)</option>
                    <option value="kitchen">Kitchen (KDS Order Prep Display)</option>
                    {isOwner && <option value="owner">Owner (Full Root Sovereignty)</option>}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => setShowAddStaffModal(false)}
                    disabled={savingStaff}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="crm-btn-primary"
                    disabled={savingStaff}
                  >
                    <UserPlus size={16} />
                    <span>{savingStaff ? 'Adding Member…' : 'Create Staff Member'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================== EDIT STAFF MODAL ===================== */}
        {editingStaff && (
          <div className="modal-backdrop" onClick={() => setEditingStaff(null)}>
            <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="modal-top-row">
                <div>
                  <span className="modal-order-tag">Edit Profile</span>
                  <h2 className="modal-order-num" style={{ fontSize: '20px' }}>{editingStaff.name}</h2>
                </div>
                <button
                  type="button"
                  className="modal-close-icon"
                  onClick={() => setEditingStaff(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} /> Full Name <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStaff.name}
                    onChange={e => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={14} /> Email Address (Read-only)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={editingStaff.email}
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={14} /> Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={editingStaff.phone || ''}
                    onChange={e => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={14} /> Reset Password (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Leave blank to keep existing password"
                    minLength={6}
                    value={editingStaff.newPassword || ''}
                    onChange={e => setEditingStaff({ ...editingStaff, newPassword: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={14} /> Role
                  </label>
                  <select
                    value={editingStaff.role}
                    disabled={!isOwner && editingStaff.role === 'owner'}
                    onChange={e => setEditingStaff({ ...editingStaff, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    {isOwner && <option value="owner">Owner (Full Root Sovereignty)</option>}
                    {isOwner && <option value="manager">Manager (Operations & Staff)</option>}
                    <option value="cashier">Cashier (POS Orders & CRM)</option>
                    <option value="kitchen">Kitchen (KDS Display)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Power size={14} /> Account Status
                  </label>
                  <select
                    value={editingStaff.status || 'active'}
                    onChange={e => setEditingStaff({ ...editingStaff, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    <option value="active">Active (Permitted to log in)</option>
                    <option value="inactive">Inactive (Login blocked)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => setEditingStaff(null)}
                    disabled={savingStaff}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="crm-btn-primary"
                    disabled={savingStaff}
                  >
                    <Check size={16} />
                    <span>{savingStaff ? 'Saving Changes…' : 'Update Staff Member'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================== AUTOMATION RULE MODAL ===================== */}
        {showRuleModal && (
          <div className="modal-backdrop" onClick={() => setShowRuleModal(false)}>
            <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
              <div className="modal-top-row">
                <div>
                  <span className="modal-order-tag">Automation Engine</span>
                  <h2 className="modal-order-num" style={{ fontSize: '20px' }}>
                    {editingRule ? 'Edit Trigger Rule' : 'Create Automation Rule'}
                  </h2>
                </div>
                <button
                  type="button"
                  className="modal-close-icon"
                  onClick={() => setShowRuleModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sliders size={14} /> Rule Name <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Near-Reward Motivation"
                    value={ruleForm.name}
                    onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={14} /> Trigger Type <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <select
                    value={ruleForm.triggerType}
                    onChange={e => {
                      const tt = e.target.value;
                      let defaultTmpl = ruleForm.messageTemplate;
                      let defaultDays = ruleForm.daysThreshold;
                      if (tt === 'near_reward') {
                        defaultTmpl = 'Hey {customerName}! Only {stampsLeft} stamps left to unlock your free treat at {cafeName}. Visit us soon: {menuUrl}';
                        defaultDays = 5;
                      } else if (tt === 'inactive_days') {
                        defaultTmpl = 'Hey {customerName}! We miss you at {cafeName}. It has been {daysInactive} days since your last coffee! Drop by today: {menuUrl}';
                        defaultDays = 14;
                      } else if (tt === 'expiring_reward') {
                        defaultTmpl = 'Hi {customerName}! Your {claimCode} voucher at {cafeName} expires on {expiryDate}. Don\'t forget to redeem it at counter!';
                        defaultDays = 3;
                      } else if (tt === 'first_visit') {
                        defaultTmpl = 'Welcome to {cafeName}, {customerName}! Thank you for your first visit. Collect stamps on every visit to unlock free rewards: {menuUrl}';
                        defaultDays = 2;
                      }
                      setRuleForm({
                        ...ruleForm,
                        triggerType: tt,
                        daysThreshold: defaultDays,
                        messageTemplate: defaultTmpl,
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    <option value="near_reward">Near Reward (1-2 stamps remaining to milestone)</option>
                    <option value="inactive_days">Lapsed Diner (No visit or order in N days)</option>
                    <option value="expiring_reward">Expiring Reward Voucher (Expires within N days)</option>
                    <option value="first_visit">Welcome Follow-up (Follow-up after 1st visit)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} /> Threshold (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      required
                      value={ruleForm.daysThreshold}
                      onChange={e => setRuleForm({ ...ruleForm, daysThreshold: Number(e.target.value) })}
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                      {ruleForm.triggerType === 'near_reward'
                        ? 'Days inactive before nudging'
                        : ruleForm.triggerType === 'inactive_days'
                        ? 'Days of diner absence'
                        : ruleForm.triggerType === 'expiring_reward'
                        ? 'Days before voucher expires'
                        : 'Days after first visit'}
                    </small>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shield size={14} /> Anti-Spam Cooldown (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      required
                      value={ruleForm.cooldownDays}
                      onChange={e => setRuleForm({ ...ruleForm, cooldownDays: Number(e.target.value) })}
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                      Min days before messaging the same customer again
                    </small>
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                      <MessageSquare size={14} /> WhatsApp Message Template <span style={{ color: 'var(--accent-red)' }}>*</span>
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click tag to insert:</span>
                  </div>

                  {/* Clickable tag chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {['{customerName}', '{cafeName}', '{stampsLeft}', '{claimCode}', '{expiryDate}', '{daysInactive}', '{menuUrl}'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className="reminder-tag-chip"
                        onClick={() => setRuleForm({ ...ruleForm, messageTemplate: (ruleForm.messageTemplate || '') + ' ' + tag })}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={4}
                    required
                    placeholder="Enter message template with placeholders like {customerName}, {stampsLeft}, {cafeName}"
                    value={ruleForm.messageTemplate}
                    onChange={e => setRuleForm({ ...ruleForm, messageTemplate: e.target.value })}
                  />
                </div>

                {/* WhatsApp Chat Bubble Mock Preview */}
                <div className="whatsapp-preview-box">
                  <div className="whatsapp-preview-header">
                    <span className="wa-dot"></span>
                    <span>Live WhatsApp Chat Preview</span>
                  </div>
                  <div className="whatsapp-bubble">
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {ruleForm.messageTemplate
                        .replace(/\{customerName\}/g, 'Aarav')
                        .replace(/\{cafeName\}/g, data.cafe?.name || 'Gusstora Café')
                        .replace(/\{stampsLeft\}/g, '2')
                        .replace(/\{currentStamps\}/g, '6')
                        .replace(/\{claimCode\}/g, 'CLM-4K8P')
                        .replace(/\{expiryDate\}/g, 'Oct 15, 2026')
                        .replace(/\{daysInactive\}/g, String(ruleForm.daysThreshold || 7))
                        .replace(/\{menuUrl\}/g, `${location.origin}/c/${data.cafe?.slug || 'demo-cafe'}`)}
                    </p>
                    <span className="whatsapp-bubble-time">10:45 AM • Delivered</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px' }}>
                    <input
                      type="checkbox"
                      checked={ruleForm.enabled}
                      onChange={e => setRuleForm({ ...ruleForm, enabled: e.target.checked })}
                    />
                    <span>Rule is enabled and ready to evaluate in audience scans</span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => setShowRuleModal(false)}
                    disabled={savingRule}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="crm-btn-primary"
                    disabled={savingRule}
                  >
                    <Check size={16} />
                    <span>{savingRule ? 'Saving Rule…' : editingRule ? 'Update Rule' : 'Save & Activate Rule'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================== DISPATCH PREVIEW & CUSTOMIZATION MODAL ===================== */}
        {dispatchModalCandidate && (
          <div className="modal-backdrop" onClick={() => setDispatchModalCandidate(null)}>
            <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
              <div className="modal-top-row">
                <div>
                  <span className="modal-order-tag">Direct WhatsApp Dispatch</span>
                  <h2 className="modal-order-num" style={{ fontSize: '19px' }}>
                    Send Reminder to {dispatchModalCandidate.customerName}
                  </h2>
                </div>
                <button
                  type="button"
                  className="modal-close-icon"
                  onClick={() => setDispatchModalCandidate(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="crm-dispatch-meta-grid">
                  <div className="crm-meta-cell">
                    <span className="crm-meta-label">Customer</span>
                    <span className="crm-meta-val">{dispatchModalCandidate.customerName}</span>
                  </div>
                  <div className="crm-meta-cell">
                    <span className="crm-meta-label">WhatsApp</span>
                    <span className="crm-meta-val">
                      <Phone size={12} style={{ color: '#176B50' }} /> {dispatchModalCandidate.customerPhone}
                    </span>
                  </div>
                  <div className="crm-meta-cell">
                    <span className="crm-meta-label">Trigger Matched</span>
                    <span className="role-badge owner" style={{ fontSize: '11px', display: 'inline-block', width: 'fit-content' }}>
                      {dispatchModalCandidate.ruleName}
                    </span>
                  </div>
                  <div className="crm-meta-cell">
                    <span className="crm-meta-label">Total Visits</span>
                    <span className="crm-meta-val">{dispatchModalCandidate.visits || 0} visits recorded</span>
                  </div>
                </div>

                {dispatchModalCandidate.inCooldown && (
                  <div className="anti-spam-alert-box">
                    <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#d97706' }} />
                    <div style={{ flex: 1 }}>
                      <b>Anti-Spam Cooldown Active</b>
                      <p>
                        This diner was already contacted {dispatchModalCandidate.daysSinceLastNotice} day(s) ago. To prevent customer fatigue, normal automated triggers skip this contact.
                      </p>
                      <label className="anti-spam-override-toggle">
                        <input
                          type="checkbox"
                          checked={forceDispatch}
                          onChange={e => setForceDispatch(e.target.checked)}
                        />
                        <span>Force override cooldown and send anyway</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={14} /> Review & Edit WhatsApp Message
                  </label>
                  <textarea
                    rows={5}
                    value={customDispatchMessage}
                    onChange={e => setCustomDispatchMessage(e.target.value)}
                    placeholder="Enter or customize message to send via WhatsApp..."
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                    Clicking send will register an audit log and instantly launch WhatsApp Direct with this pre-filled message.
                  </small>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => setDispatchModalCandidate(null)}
                    disabled={dispatchingCustom}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="crm-btn-whatsapp"
                    disabled={dispatchingCustom || (dispatchModalCandidate.inCooldown && !forceDispatch)}
                    onClick={() => handleDispatchSingle(dispatchModalCandidate, customDispatchMessage, forceDispatch)}
                    style={{ padding: '10px 18px' }}
                  >
                    <Send size={15} />
                    <span>{dispatchingCustom ? 'Dispatching…' : 'Send via WhatsApp'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== PHASE 7: FEEDBACK RESOLUTION MODAL ===================== */}
        {resolvingFeedbackModal && (
          <div className="modal-backdrop" onClick={() => setResolvingFeedbackModal(null)}>
            <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="modal-top-row">
                <div>
                  <span className="modal-order-tag">PRIVATE ISSUE RESOLUTION</span>
                  <h2 className="modal-order-num" style={{ fontSize: '18px' }}>
                    Resolve Issue from {resolvingFeedbackModal.dinerName || 'Guest'}
                  </h2>
                </div>
                <button
                  type="button"
                  className="modal-close-icon"
                  onClick={() => setResolvingFeedbackModal(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="crm-dispatch-meta-grid">
                  <div className="crm-meta-cell">
                    <span className="crm-meta-label">Rating</span>
                    <span className="crm-meta-val" style={{ color: '#e11d48', fontWeight: 'bold' }}>
                      {resolvingFeedbackModal.rating} / 5 Stars
                    </span>
                  </div>
                  <div className="crm-meta-cell">
                    <span className="crm-meta-label">Customer Contact</span>
                    <span className="crm-meta-val">
                      {resolvingFeedbackModal.dinerPhone || 'No phone recorded'}
                    </span>
                  </div>
                  <div className="crm-meta-cell">
                    <span className="crm-meta-label">Order Ref</span>
                    <span className="crm-meta-val">
                      {resolvingFeedbackModal.Order ? `#${resolvingFeedbackModal.Order.orderNo}` : 'Direct Visit'}
                    </span>
                  </div>
                  <div className="crm-meta-cell">
                    <span className="crm-meta-label">Aspects Flagged</span>
                    <span className="crm-meta-val">
                      {resolvingFeedbackModal.aspects?.join(', ') || 'General experience'}
                    </span>
                  </div>
                </div>

                {resolvingFeedbackModal.comment && (
                  <div style={{ background: '#fff5f5', borderLeft: '3px solid #e11d48', padding: '10px 14px', borderRadius: '6px' }}>
                    <small style={{ fontWeight: 'bold', color: '#9f1239' }}>Diner's Feedback:</small>
                    <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#4c0519' }}>
                      "{resolvingFeedbackModal.comment}"
                    </p>
                  </div>
                )}

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                    <ShieldCheck size={14} /> Management Resolution Notes
                  </label>
                  <textarea
                    rows={4}
                    value={resolutionNotesInput}
                    onChange={e => setResolutionNotesInput(e.target.value)}
                    placeholder="Describe how this issue was resolved (e.g., Contacted diner by phone, refunded latte, briefed barista on brew speed)..."
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                    This note will be recorded permanently in the audit trail under your staff account ({currentUser?.name || 'Manager'}).
                  </small>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => setResolvingFeedbackModal(null)}
                    disabled={savingResolution}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="crm-btn-primary"
                    disabled={savingResolution || !resolutionNotesInput.trim()}
                    onClick={() => handleResolveFeedback(resolvingFeedbackModal._id || resolvingFeedbackModal.id)}
                  >
                    <Check size={16} />
                    <span>{savingResolution ? 'Saving…' : 'Mark as Resolved'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== PHASE 10: ADVANCED TABLE & RESERVATION MODALS ===================== */}

        {/* 1. Quick Walk-In Seating Modal */}
        {walkinModal && (
          <div className="modal-backdrop" onClick={() => setWalkinModal(null)}>
            <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="modal-top-row">
                <span className="modal-order-tag">1-TAP WALK-IN SEATING</span>
                <h2 className="modal-order-num" style={{ fontSize: '20px' }}>
                  Seat Walk-In on Table T-{walkinModal.table?.tableNumber}
                </h2>
                <button type="button" className="modal-close-icon" onClick={() => setWalkinModal(null)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleQuickWalkinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                <div className="table-quick-spec-card">
                  <div className="spec-item">
                    <span className="spec-label">Zone:</span>
                    <span className="spec-val">{walkinModal.table?.section || 'Main Floor'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Table Name:</span>
                    <span className="spec-val">{walkinModal.table?.name || `Table ${walkinModal.table?.tableNumber}`}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Max Capacity:</span>
                    <span className="spec-val">{walkinModal.table?.capacity || 4} Guests</span>
                  </div>
                </div>

                {tableConflictNotice && (
                  <div className="conflict-error-box">
                    <AlertCircle size={16} />
                    <span>{tableConflictNotice}</span>
                  </div>
                )}

                <div className="form-group">
                  <label>
                    <Users size={14} /> Party Size (Guests) <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={walkinModal.table?.capacity ? walkinModal.table.capacity + 2 : 20}
                    value={walkinPartySize}
                    onChange={e => setWalkinPartySize(Number(e.target.value))}
                    required
                  />
                  {walkinPartySize > (walkinModal.table?.capacity || 4) && (
                    <small style={{ color: '#d97706', fontSize: '11.5px', marginTop: '3px' }}>
                      Party size exceeds recommended seating capacity ({walkinModal.table?.capacity} guests).
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    <UserCheck size={14} /> Guest Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder={`e.g. Walk-in Guest (T-${walkinModal.table?.tableNumber})`}
                    value={walkinGuestName}
                    onChange={e => setWalkinGuestName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <Phone size={14} /> Guest Mobile (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile number for loyalty/receipt"
                    value={walkinPhone}
                    onChange={e => setWalkinPhone(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <MessageSquare size={14} /> Special Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. High chair needed, anniversary tasting"
                    value={walkinNote}
                    onChange={e => setWalkinNote(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => setWalkinModal(null)}
                    disabled={walkinSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="crm-btn-primary"
                    disabled={walkinSubmitting}
                  >
                    <Check size={16} />
                    <span>{walkinSubmitting ? 'Seating Diners…' : 'Seat Diners Now'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2. New Advance Reservation Modal */}
        {newBookingModal && (
          <div className="modal-backdrop" onClick={() => setNewBookingModal(false)}>
            <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
              <div className="modal-top-row">
                <span className="modal-order-tag">ADVANCE RESERVATION ENGINE</span>
                <h2 className="modal-order-num" style={{ fontSize: '20px' }}>New Table Reservation</h2>
                <button type="button" className="modal-close-icon" onClick={() => setNewBookingModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
                {tableConflictNotice && (
                  <div className="conflict-error-box">
                    <AlertCircle size={16} />
                    <span>{tableConflictNotice}</span>
                  </div>
                )}

                <div className="form-grid-2col">
                  <div className="form-group">
                    <label>
                      <UserCheck size={14} /> Guest Name <span style={{ color: 'var(--accent-red)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ananya Roy"
                      value={newBookingName}
                      onChange={e => setNewBookingName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Phone size={14} /> 10-Digit Mobile <span style={{ color: 'var(--accent-red)' }}>*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="9876543210"
                      value={newBookingPhone}
                      onChange={e => setNewBookingPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2col">
                  <div className="form-group">
                    <label>
                      <Calendar size={14} /> Date & Time <span style={{ color: 'var(--accent-red)' }}>*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={newBookingDateTime}
                      onChange={e => setNewBookingDateTime(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Users size={14} /> Party Size (Guests) <span style={{ color: 'var(--accent-red)' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      required
                      value={newBookingGuests}
                      onChange={e => setNewBookingGuests(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="form-grid-2col">
                  <div className="form-group">
                    <label>
                      <Armchair size={14} /> Assign Table (Optional)
                    </label>
                    <select
                      value={newBookingTableId}
                      onChange={e => setNewBookingTableId(e.target.value)}
                    >
                      <option value="">Auto-assign or Assign on Arrival</option>
                      {tablesList.map(t => (
                        <option key={t.id} value={t.id}>
                          T-{t.tableNumber}: {t.name || `Table ${t.tableNumber}`} ({t.capacity}p · {t.section})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>
                      <Timer size={14} /> Dining Slot Duration
                    </label>
                    <select
                      value={newBookingDuration}
                      onChange={e => setNewBookingDuration(Number(e.target.value))}
                    >
                      <option value={60}>60 Minutes (Fast Casual)</option>
                      <option value={90}>90 Minutes (Standard Tasting)</option>
                      <option value={120}>120 Minutes (Celebration / Dinner)</option>
                      <option value={180}>180 Minutes (Private Tasting Flight)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    <MessageSquare size={14} /> Guest Notes & Dietary Preferences
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Birthday celebration, vegan options requested"
                    value={newBookingNote}
                    onChange={e => setNewBookingNote(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => setNewBookingModal(false)}
                    disabled={newBookingSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="crm-btn-primary"
                    disabled={newBookingSubmitting}
                  >
                    <Check size={16} />
                    <span>{newBookingSubmitting ? 'Booking Table…' : 'Create Reservation'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 3. Assign / Reassign Table Modal */}
        {reassignModal && (
          <div className="modal-backdrop" onClick={() => setReassignModal(null)}>
            <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-top-row">
                <span className="modal-order-tag">SEATING DISPATCH</span>
                <h2 className="modal-order-num" style={{ fontSize: '20px' }}>
                  Assign Table for {reassignModal.booking?.name}
                </h2>
                <button type="button" className="modal-close-icon" onClick={() => setReassignModal(null)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAssignTableSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                <div className="table-quick-spec-card">
                  <div className="spec-item">
                    <span className="spec-label">Guest:</span>
                    <span className="spec-val">{reassignModal.booking?.name}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Party Size:</span>
                    <span className="spec-val">{reassignModal.booking?.guests} Guests</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Time:</span>
                    <span className="spec-val">
                      {new Date(reassignModal.booking?.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {tableConflictNotice && (
                  <div className="conflict-error-box">
                    <AlertCircle size={16} />
                    <span>{tableConflictNotice}</span>
                  </div>
                )}

                <div className="form-group">
                  <label>
                    <Armchair size={14} /> Select Cafe Table <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <select
                    value={reassignSelectedTableId}
                    onChange={e => setReassignSelectedTableId(e.target.value)}
                    required
                  >
                    <option value="">Choose Available Table...</option>
                    {tablesList.map(t => {
                      const fitsParty = t.capacity >= (reassignModal.booking?.guests || 1);
                      return (
                        <option key={t.id} value={t.id}>
                          T-{t.tableNumber}: {t.name} ({t.capacity}p · {t.section}) - Status: {t.status} {!fitsParty ? '(Smaller than party)' : '(Good fit)'}
                        </option>
                      );
                    })}
                  </select>
                  <small style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginTop: '4px' }}>
                    Conflict engine automatically checks for time-slot overlaps within the 90m dining window.
                  </small>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => setReassignModal(null)}
                    disabled={reassignSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="crm-btn-primary"
                    disabled={reassignSubmitting || !reassignSelectedTableId}
                  >
                    <Check size={16} />
                    <span>{reassignSubmitting ? 'Assigning…' : 'Confirm Table Assignment'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 4. Table Configuration Modal (Add / Edit Table) */}
        {tableConfigModal && (
          <div className="modal-backdrop" onClick={() => setTableConfigModal(null)}>
            <div className="theme-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="modal-top-row">
                <span className="modal-order-tag">FLOOR PLAN CONFIGURATION</span>
                <h2 className="modal-order-num" style={{ fontSize: '20px' }}>
                  {tableConfigModal.isNew ? 'Add New Floor Table' : `Configure Table T-${tableConfigModal.table?.tableNumber}`}
                </h2>
                <button type="button" className="modal-close-icon" onClick={() => setTableConfigModal(null)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveTableSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
                <div className="form-grid-2col">
                  <div className="form-group">
                    <label>
                      <Armchair size={14} /> Table Number / Code <span style={{ color: 'var(--accent-red)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 15, VIP-1, P-2"
                      value={editTableNumber}
                      onChange={e => setEditTableNumber(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Users size={14} /> Seating Capacity <span style={{ color: 'var(--accent-red)' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      required
                      value={editTableCapacity}
                      onChange={e => setEditTableCapacity(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Display Name / Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Patio Garden Corner, Roaster Loft"
                    value={editTableName}
                    onChange={e => setEditTableName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>
                    Floor Zone / Section <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <select
                    value={editTableSection}
                    onChange={e => setEditTableSection(e.target.value)}
                  >
                    <option value="Main Floor">Main Floor</option>
                    <option value="Window Section">Window Section</option>
                    <option value="Patio Garden">Patio Garden</option>
                    <option value="Mezzanine Booth">Mezzanine Booth</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  {!tableConfigModal.isNew && (
                    <button
                      type="button"
                      className="crm-btn-danger-outline"
                      onClick={() => handleDeleteTable(tableConfigModal.table.id)}
                    >
                      <Trash2 size={14} /> Remove Table
                    </button>
                  )}

                  <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
                    <button
                      type="button"
                      className="crm-btn-secondary"
                      onClick={() => setTableConfigModal(null)}
                      disabled={editTableSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="crm-btn-primary"
                      disabled={editTableSubmitting}
                    >
                      <Check size={16} />
                      <span>{editTableSubmitting ? 'Saving…' : 'Save Table'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================== PHASE 3: EXTRACTED MODULAR MODALS ===================== */}
        <ShiftModals
          shiftModalMode={shiftModalMode}
          setShiftModalMode={setShiftModalMode}
          currentShiftData={currentShiftData}
          currentUser={currentUser}
          openingFloatInput={openingFloatInput}
          setOpeningFloatInput={setOpeningFloatInput}
          closingCountedInput={closingCountedInput}
          setClosingCountedInput={setClosingCountedInput}
          shiftNotesInput={shiftNotesInput}
          setShiftNotesInput={setShiftNotesInput}
          savingShiftAction={savingShiftAction}
          handleOpenShift={handleOpenShift}
          handleCloseShift={handleCloseShift}
          zReportModalData={zReportModalData}
          setZReportModalData={setZReportModalData}
          shiftsHistoryList={shiftsHistoryList}
          loadingShiftsHistory={loadingShiftsHistory}
          fetchZReport={fetchZReport}
          cafe={data?.cafe}
          money={money}
        />

        <BillOperationsModals
          transferOrderModal={transferOrderModal}
          setTransferOrderModal={setTransferOrderModal}
          transferTargetTable={transferTargetTable}
          setTransferTargetTable={setTransferTargetTable}
          submittingTransfer={submittingTransfer}
          handleTransferTable={handleTransferTable}
          splitOrderModal={splitOrderModal}
          setSplitOrderModal={setSplitOrderModal}
          splitDinerCount={splitDinerCount}
          setSplitDinerCount={setSplitDinerCount}
          submittingSplit={submittingSplit}
          handleSplitBill={handleSplitBill}
          payingSplitId={payingSplitId}
          handlePaySplit={handlePaySplit}
          discountOrderModal={discountOrderModal}
          setDiscountOrderModal={setDiscountOrderModal}
          discountTypeInput={discountTypeInput}
          setDiscountTypeInput={setDiscountTypeInput}
          discountValueInput={discountValueInput}
          setDiscountValueInput={setDiscountValueInput}
          discountPromoInput={discountPromoInput}
          setDiscountPromoInput={setDiscountPromoInput}
          validatingPromo={validatingPromo}
          handleValidatePromo={handleValidatePromo}
          promoValidationResult={promoValidationResult}
          discountReasonInput={discountReasonInput}
          setDiscountReasonInput={setDiscountReasonInput}
          discountAuthorizedBy={discountAuthorizedBy}
          setDiscountAuthorizedBy={setDiscountAuthorizedBy}
          submittingDiscount={submittingDiscount}
          handleApplyDiscount={handleApplyDiscount}
          showAddPromoModal={showAddPromoModal}
          setShowAddPromoModal={setShowAddPromoModal}
          promoCodeForm={promoCodeForm}
          setPromoCodeForm={setPromoCodeForm}
          savingPromoCode={savingPromoCode}
          handleCreatePromoCode={handleCreatePromoCode}
          currentUser={currentUser}
        />

        <OfflineSyncModal
          isOpen={showOfflineSyncModal}
          onClose={() => setShowOfflineSyncModal(false)}
          isOnline={isOnline}
          onSyncSuccess={async () => {
            setError('Synced offline order(s) successfully!');
            const pending = await getPendingOfflineOrders().catch(() => []);
            setOfflineQueueCount(pending.length + getOfflineQueue().length);
            load();
          }}
          api={api}
        />
      </main>
    </div>
  );
}
