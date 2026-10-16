import bcrypt from 'bcryptjs';
import { Cafe, MenuItem, User, ReminderRule, Customer, Order, Reward, Feedback, CafeTable, Booking, InventoryItem, RecipeItem, StockLedger, Brand, DeliveryChannel, WhatsAppConfig } from './models.js';

export async function ensureSeedData(options = {}) {
  const isMock = Boolean(options && options.Cafe && options.Cafe !== Cafe);
  const CafeModel = options.Cafe || Cafe;
  const MenuItemModel = options.MenuItem || MenuItem;
  const UserModel = options.User || User;
  const RuleModel = options.ReminderRuleModel || options.ReminderRule || (isMock ? null : ReminderRule);
  const CustomerModel = options.Customer || (isMock ? null : Customer);
  const OrderModel = options.Order || (isMock ? null : Order);
  const RewardModel = options.Reward || (isMock ? null : Reward);
  const TableModel = options.CafeTable || (isMock ? null : CafeTable);
  const BookingModel = options.Booking || (isMock ? null : Booking);
  const FeedbackModel = options.Feedback || (isMock ? null : Feedback);
  const InventoryItemModel = options.InventoryItem || (isMock ? null : InventoryItem);
  const RecipeItemModel = options.RecipeItem || (isMock ? null : RecipeItem);
  const StockLedgerModel = options.StockLedger || (isMock ? null : StockLedger);
  const BrandModel = options.Brand || (isMock ? null : Brand);
  const DeliveryChannelModel = options.DeliveryChannel || (isMock ? null : DeliveryChannel);
  const WhatsAppConfigModel = options.WhatsAppConfig || (isMock ? null : WhatsAppConfig);
  let cafe = await CafeModel.findOne({ where: { slug: 'demo-cafe' } });
  if (!cafe) {
    cafe = await CafeModel.create({
      name: 'The Daily Grind',
      slug: 'demo-cafe',
      phone: '+91 98765 43210',
      address: 'C-Scheme, Jaipur',
      googleReviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
      instagramUrl: 'https://instagram.com/gusstora.cafe',
      tagline: 'Artisanal Roastery, Specialty Brews & Warm Bites',
      brandColor: '#ea580c',
      wifiSsid: 'Gusstora-Roastery-5G',
      wifiPassword: 'perkbytecoffee',
      tables: 12,
    });
    await MenuItemModel.bulkCreate([
      {
        cafeId: cafe.id,
        name: 'Cappuccino',
        description: 'Double espresso, velvety steamed microfoam',
        category: 'Coffee',
        price: 220,
        veg: true,
        variants: [
          { id: 'v_cap_reg', name: 'Regular (250ml)', price: 220 },
          { id: 'v_cap_lrg', name: 'Large (350ml)', price: 260 },
        ],
        modifierGroups: [
          {
            id: 'mg_milk',
            name: 'Choice of Milk',
            required: false,
            maxSelect: 1,
            options: [
              { id: 'opt_oat', name: 'Oat Milk', price: 40 },
              { id: 'opt_almond', name: 'Almond Milk', price: 50 },
              { id: 'opt_soy', name: 'Soy Milk', price: 30 },
            ],
          },
          {
            id: 'mg_extra',
            name: 'Add-ons & Syrups',
            required: false,
            maxSelect: 2,
            options: [
              { id: 'opt_shot', name: 'Extra Espresso Shot', price: 50 },
              { id: 'opt_vanilla', name: 'Madagascar Vanilla Syrup', price: 30 },
              { id: 'opt_hazelnut', name: 'Roasted Hazelnut Syrup', price: 30 },
            ],
          },
        ],
      },
      {
        cafeId: cafe.id,
        name: 'Cold Coffee',
        description: 'Creamy house blend over ice',
        category: 'Coffee',
        price: 260,
        veg: true,
        variants: [
          { id: 'v_cc_reg', name: 'Classic Cold Brew (300ml)', price: 260 },
          { id: 'v_cc_frappe', name: 'Ice Blended Frappe (400ml)', price: 310 },
        ],
        modifierGroups: [
          {
            id: 'mg_cc_topping',
            name: 'Toppings & Syrups',
            required: false,
            maxSelect: 2,
            options: [
              { id: 'opt_icecream', name: 'Vanilla Ice Cream Scoop', price: 50 },
              { id: 'opt_caramel', name: 'Salted Caramel Drizzle', price: 30 },
            ],
          },
        ],
      },
      {
        cafeId: cafe.id,
        name: 'Paneer Tikka Sandwich',
        description: 'Smoky tandoori paneer, mint chutney, toasted sourdough',
        category: 'Bites',
        price: 320,
        veg: true,
        variants: [
          { id: 'v_pts_half', name: 'Single Half-Panini', price: 210 },
          { id: 'v_pts_full', name: 'Full Club Sandwich', price: 320 },
        ],
        modifierGroups: [
          {
            id: 'mg_bread',
            name: 'Bread Selection',
            required: false,
            maxSelect: 1,
            options: [
              { id: 'opt_sourdough', name: 'Artisan Sourdough', price: 0 },
              { id: 'opt_multigrain', name: 'Multigrain Brioche', price: 20 },
              { id: 'opt_glutenfree', name: 'Gluten-Free Bread', price: 40 },
            ],
          },
          {
            id: 'mg_cheese',
            name: 'Cheese & Sides',
            required: false,
            maxSelect: 2,
            options: [
              { id: 'opt_extra_cheese', name: 'Double Mozzarella Melt', price: 45 },
              { id: 'opt_wedges', name: 'Side Peri Peri Wedges', price: 70 },
            ],
          },
        ],
      },
      { cafeId: cafe.id, name: 'Truffle Pasta', description: 'Creamy mushroom and parmesan', category: 'Mains', price: 480, veg: true },
      { cafeId: cafe.id, name: 'Chocolate Cheesecake', description: 'Dark chocolate, biscuit crumb', category: 'Dessert', price: 280, veg: true },
    ]);
  } else {
    // Ensure existing demo cafe has modifiers populated for testing
    if (MenuItemModel && MenuItemModel.findAll) {
      const existingItems = await MenuItemModel.findAll({ where: { cafeId: cafe.id } });
      for (const item of existingItems) {
        if (item.name === 'Cappuccino' && (!item.variants || !item.variants.length)) {
          await item.update({
            variants: [
              { id: 'v_cap_reg', name: 'Regular (250ml)', price: 220 },
              { id: 'v_cap_lrg', name: 'Large (350ml)', price: 260 },
            ],
            modifierGroups: [
              {
                id: 'mg_milk',
                name: 'Choice of Milk',
                required: false,
                maxSelect: 1,
                options: [
                  { id: 'opt_oat', name: 'Oat Milk', price: 40 },
                  { id: 'opt_almond', name: 'Almond Milk', price: 50 },
                  { id: 'opt_soy', name: 'Soy Milk', price: 30 },
                ],
              },
              {
                id: 'mg_extra',
                name: 'Add-ons & Syrups',
                required: false,
                maxSelect: 2,
                options: [
                  { id: 'opt_shot', name: 'Extra Espresso Shot', price: 50 },
                  { id: 'opt_vanilla', name: 'Madagascar Vanilla Syrup', price: 30 },
                  { id: 'opt_hazelnut', name: 'Roasted Hazelnut Syrup', price: 30 },
                ],
              },
            ],
          }).catch(() => {});
        } else if (item.name === 'Cold Coffee' && (!item.variants || !item.variants.length)) {
          await item.update({
            variants: [
              { id: 'v_cc_reg', name: 'Classic Cold Brew (300ml)', price: 260 },
              { id: 'v_cc_frappe', name: 'Ice Blended Frappe (400ml)', price: 310 },
            ],
            modifierGroups: [
              {
                id: 'mg_cc_topping',
                name: 'Toppings & Syrups',
                required: false,
                maxSelect: 2,
                options: [
                  { id: 'opt_icecream', name: 'Vanilla Ice Cream Scoop', price: 50 },
                  { id: 'opt_caramel', name: 'Salted Caramel Drizzle', price: 30 },
                ],
              },
            ],
          }).catch(() => {});
        } else if (item.name === 'Paneer Tikka Sandwich' && (!item.variants || !item.variants.length)) {
          await item.update({
            variants: [
              { id: 'v_pts_half', name: 'Single Half-Panini', price: 210 },
              { id: 'v_pts_full', name: 'Full Club Sandwich', price: 320 },
            ],
            modifierGroups: [
              {
                id: 'mg_bread',
                name: 'Bread Selection',
                required: false,
                maxSelect: 1,
                options: [
                  { id: 'opt_sourdough', name: 'Artisan Sourdough', price: 0 },
                  { id: 'opt_multigrain', name: 'Multigrain Brioche', price: 20 },
                  { id: 'opt_glutenfree', name: 'Gluten-Free Bread', price: 40 },
                ],
              },
              {
                id: 'mg_cheese',
                name: 'Cheese & Sides',
                required: false,
                maxSelect: 2,
                options: [
                  { id: 'opt_extra_cheese', name: 'Double Mozzarella Melt', price: 45 },
                  { id: 'opt_wedges', name: 'Side Peri Peri Wedges', price: 70 },
                ],
              },
            ],
          }).catch(() => {});
        }
      }
    }

    if (!cafe.tagline || !cafe.wifiSsid) {
      if (typeof cafe.update === 'function') {
        await cafe.update({
          googleReviewUrl: cafe.googleReviewUrl || 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
          instagramUrl: cafe.instagramUrl || 'https://instagram.com/gusstora.cafe',
          tagline: cafe.tagline || 'Artisanal Roastery, Specialty Brews & Warm Bites',
          brandColor: cafe.brandColor || '#ea580c',
          wifiSsid: cafe.wifiSsid || 'Gusstora-Roastery-5G',
          wifiPassword: cafe.wifiPassword || 'perkbytecoffee',
          tables: cafe.tables || 12,
        });
      }
    }
  }

  const demoStaff = [
    { name: 'Demo Owner', email: 'owner@perkbyte.demo', role: 'owner', phone: '9876500001' },
    { name: 'Aditi Sharma (Manager)', email: 'manager@perkbyte.demo', role: 'manager', phone: '9876500002' },
    { name: 'Rahul Sen (Cashier)', email: 'cashier@perkbyte.demo', role: 'cashier', phone: '9876500003' },
    { name: 'Chef Karan (Kitchen)', email: 'kitchen@perkbyte.demo', role: 'kitchen', phone: '9876500004' },
  ];

  for (const s of demoStaff) {
    const existing = await UserModel.findOne({ where: { email: s.email } });
    if (!existing) {
      await UserModel.create({
        name: s.name,
        email: s.email,
        phone: s.phone,
        passwordHash: await bcrypt.hash('Demo@123', 12),
        role: s.role,
        status: 'active',
        cafeId: cafe.id,
      });
    }
  }

  if (RuleModel) {
    const existingRules = await RuleModel.count({ where: { cafeId: cafe.id } });
    if (existingRules === 0) {
      await RuleModel.bulkCreate([
        {
          name: 'Near-Reward Motivation (1-2 Stamps Left)',
          triggerType: 'near_reward',
          daysThreshold: 5,
          channel: 'whatsapp',
          messageTemplate: 'Hey {customerName}! You are only {stampsLeft} visit away from unlocking your free perk at {cafeName}! Drop in this week: {menuUrl}',
          cooldownDays: 7,
          enabled: true,
          cafeId: cafe.id,
        },
        {
          name: '14-Day Inactive Diner Wakeup',
          triggerType: 'inactive_days',
          daysThreshold: 14,
          channel: 'whatsapp',
          messageTemplate: 'We miss you at {cafeName}, {customerName}! Your favorite table and fresh brews are waiting. Check out our latest treats: {menuUrl}',
          cooldownDays: 14,
          enabled: true,
          cafeId: cafe.id,
        },
        {
          name: 'Expiring Reward Voucher Alert',
          triggerType: 'expiring_reward',
          daysThreshold: 3,
          channel: 'whatsapp',
          messageTemplate: 'Reminder: Your reward voucher {claimCode} at {cafeName} expires soon! Don\'t let your free reward go to waste: {menuUrl}',
          cooldownDays: 3,
          enabled: true,
          cafeId: cafe.id,
        },
      ]);
    }
  }

  // Seed demo customers for CRM & automated reminders if not already present
  if (CustomerModel && CustomerModel.findOne) {
    const existingDemoCust = await CustomerModel.findOne({ where: { phone: '9876511111', cafeId: cafe.id } });
    if (!existingDemoCust && CustomerModel.create) {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      const eighteenDaysAgo = new Date(Date.now() - 18 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

      const c1 = await CustomerModel.create({
        name: 'Pooja Verma',
        phone: '9876511111',
        email: 'pooja@example.com',
        visits: 7, // 7 stamps out of 8 -> 1 visit away from reward (matches near_reward trigger)
        cafeId: cafe.id,
      });
      if (OrderModel && OrderModel.create) {
        await OrderModel.create({
          orderNo: 'ORD-101',
          customerName: c1.name,
          phone: c1.phone,
          subtotal: 540,
          total: 540,
          status: 'completed',
          paymentStatus: 'paid',
          loyaltyProcessed: true,
          cafeId: cafe.id,
          customerId: c1.id,
          createdAt: sixDaysAgo,
          updatedAt: sixDaysAgo,
        });
      }

      const c2 = await CustomerModel.create({
        name: 'Vikram Malhotra',
        phone: '9876522222',
        email: 'vikram@example.com',
        visits: 2,
        cafeId: cafe.id,
      });
      if (OrderModel && OrderModel.create) {
        await OrderModel.create({
          orderNo: 'ORD-102',
          customerName: c2.name,
          phone: c2.phone,
          subtotal: 320,
          total: 320,
          status: 'completed',
          paymentStatus: 'paid',
          loyaltyProcessed: true,
          cafeId: cafe.id,
          customerId: c2.id,
          createdAt: eighteenDaysAgo,
          updatedAt: eighteenDaysAgo,
        });
      }

      const c3 = await CustomerModel.create({
        name: 'Ananya Gupta',
        phone: '9876533333',
        email: 'ananya@example.com',
        visits: 8,
        cafeId: cafe.id,
      });
      if (OrderModel && OrderModel.create) {
        await OrderModel.create({
          orderNo: 'ORD-103',
          customerName: c3.name,
          phone: c3.phone,
          subtotal: 680,
          total: 680,
          status: 'completed',
          paymentStatus: 'paid',
          loyaltyProcessed: true,
          cafeId: cafe.id,
          customerId: c3.id,
          createdAt: twoDaysAgo,
          updatedAt: twoDaysAgo,
        });
      }
      if (RewardModel && RewardModel.create) {
        await RewardModel.create({
          amount: 150,
          claimCode: 'CLM-FREE99',
          status: 'available',
          expiresAt: twoDaysFromNow,
          cafeId: cafe.id,
          customerId: c3.id,
        });
      }
    }
  }

  // Seed sample diner feedback reviews if none exist
  if (FeedbackModel && FeedbackModel.count && FeedbackModel.bulkCreate) {
    const feedbackCount = await FeedbackModel.count({ where: { cafeId: cafe.id } });
    if (feedbackCount === 0) {
      const now = new Date();
      const oneDayAgo = new Date(Date.now() - 24 * 3600000);
      const twoDaysAgo = new Date(Date.now() - 48 * 3600000);
      const threeDaysAgo = new Date(Date.now() - 72 * 3600000);

      await FeedbackModel.bulkCreate([
        {
          rating: 5,
          sentiment: 'positive',
          aspects: ['Food Quality', 'Staff Courtesy', 'Ambiance'],
          comment: 'Loved the oat milk cappuccino and warm ambiance! Staff was super polite and attentive.',
          customerName: 'Ananya Gupta',
          customerPhone: '9876533333',
          isPublic: true,
          status: 'reviewed',
          cafeId: cafe.id,
          createdAt: oneDayAgo,
          updatedAt: oneDayAgo,
        },
        {
          rating: 5,
          sentiment: 'positive',
          aspects: ['Food Quality', 'Service Speed'],
          comment: 'Crispy sourdough toast and great espresso roast. Definitely our new Sunday coffee spot!',
          customerName: 'Rahul Verma',
          customerPhone: '9876544444',
          isPublic: true,
          status: 'reviewed',
          cafeId: cafe.id,
          createdAt: twoDaysAgo,
          updatedAt: twoDaysAgo,
        },
        {
          rating: 4,
          sentiment: 'positive',
          aspects: ['Food Quality', 'Ambiance'],
          comment: 'Great vibes and cold coffee was on point. Took about 10 mins during rush hour but worth the wait.',
          customerName: 'Priya Sharma',
          customerPhone: '9876543210',
          isPublic: true,
          status: 'reviewed',
          cafeId: cafe.id,
          createdAt: threeDaysAgo,
          updatedAt: threeDaysAgo,
        },
        {
          rating: 2,
          sentiment: 'critical',
          aspects: ['Cleanliness', 'Service Speed'],
          comment: 'Table was not wiped down promptly upon arrival and the beverage was lukewarm.',
          customerName: 'Vikram Malhotra',
          customerPhone: '9876522222',
          isPublic: false,
          status: 'new',
          cafeId: cafe.id,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
  }

  // Phase 10: Seed default tables if none exist
  if (TableModel && TableModel.count && TableModel.create) {
    const existingTablesCount = await TableModel.count({ where: { cafeId: cafe.id } });
    if (existingTablesCount === 0) {
      const defaultTables = [
        { tableNumber: '1', name: 'Window Espresso Bistro', capacity: 2, section: 'Window Section', status: 'available' },
        { tableNumber: '2', name: 'Sunlight Garden Table', capacity: 2, section: 'Window Section', status: 'available' },
        { tableNumber: '3', name: 'Book Nook Corner', capacity: 2, section: 'Window Section', status: 'available' },
        { tableNumber: '4', name: 'Pour-Over Brew Bar', capacity: 2, section: 'Window Section', status: 'available' },
        { tableNumber: '5', name: 'Central Oak Dining', capacity: 4, section: 'Main Floor', status: 'occupied' },
        { tableNumber: '6', name: 'Artisanal Hearth Table', capacity: 4, section: 'Main Floor', status: 'available' },
        { tableNumber: '7', name: 'Copper Arch Table', capacity: 4, section: 'Main Floor', status: 'available' },
        { tableNumber: '8', name: 'Roastery Table', capacity: 4, section: 'Main Floor', status: 'available' },
        { tableNumber: '9', name: 'Garden Veranda', capacity: 6, section: 'Patio Garden', status: 'available' },
        { tableNumber: '10', name: 'Olive Tree Table', capacity: 6, section: 'Patio Garden', status: 'available' },
        { tableNumber: '11', name: 'Velvet Booth Alpha', capacity: 6, section: 'Mezzanine Booth', status: 'reserved' },
        { tableNumber: '12', name: 'Velvet Booth Beta', capacity: 6, section: 'Mezzanine Booth', status: 'available' },
      ];

      const createdTables = [];
      for (const t of defaultTables) {
        const tbl = await TableModel.create({
          cafeId: cafe.id,
          ...t,
        });
        createdTables.push(tbl);
      }

      // Seed realistic initial bookings
      const table5 = createdTables.find(t => t.tableNumber === '5');
      const table11 = createdTables.find(t => t.tableNumber === '11');

      const thirtyMinsAgo = new Date(Date.now() - 35 * 60 * 1000);
      const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const tomorrowEvening = new Date(Date.now() + 26 * 60 * 60 * 1000);

      // Active Seated Booking on Table 5
      if (table5 && BookingModel && BookingModel.create) {
        const seatedBooking = await BookingModel.create({
          cafeId: cafe.id,
          name: 'Rohit Singhania',
          phone: '9876511111',
          guests: 3,
          dateTime: thirtyMinsAgo,
          durationMinutes: 90,
          tableId: table5.id,
          tableNumber: '5',
          note: 'Walk-in dining, loves cortado and truffle pasta.',
          status: 'seated',
          seatedAt: thirtyMinsAgo,
          source: 'walk-in',
        });
        if (typeof table5.update === 'function') {
          await table5.update({ currentBookingId: seatedBooking.id });
        }
      }

      // Confirmed Booking on Table 11
      if (table11 && BookingModel && BookingModel.create) {
        await BookingModel.create({
          cafeId: cafe.id,
          name: 'Meera Kapoor',
          phone: '9876522222',
          guests: 5,
          dateTime: twoHoursLater,
          durationMinutes: 90,
          tableId: table11.id,
          tableNumber: '11',
          note: 'Birthday celebration with family, requested booth.',
          status: 'confirmed',
          source: 'online',
        });
      }

      // Pending Request
      if (BookingModel && BookingModel.create) {
        await BookingModel.create({
          cafeId: cafe.id,
          name: 'Arjun Mehta',
          phone: '9876533333',
          guests: 4,
          dateTime: tomorrowEvening,
          durationMinutes: 90,
          note: 'Table for client meeting, quiet corner preferred.',
          status: 'pending',
          source: 'online',
        });
      }
    }

    // Seed Demo Inventory Ingredients & Recipe BOMs if not already created
    if (InventoryItemModel && InventoryItemModel.count) {
      const invCount = await InventoryItemModel.count({ where: { cafeId: cafe.id } });
      if (invCount === 0 && InventoryItemModel.create) {
        const beans = await InventoryItemModel.create({
          cafeId: cafe.id,
          name: 'Specialty Espresso Beans (Arabica Blend)',
          sku: 'ING-COF-01',
          category: 'coffee',
          currentStock: 12.5,
          unit: 'kg',
          lowStockThreshold: 2.5,
          costPerUnit: 1100,
          supplier: 'Blue Tokai Roasters',
          status: 'in_stock',
          isActive: true,
        });

        const milk = await InventoryItemModel.create({
          cafeId: cafe.id,
          name: 'Whole Farm Fresh Milk',
          sku: 'ING-MLK-01',
          category: 'dairy',
          currentStock: 24.0,
          unit: 'l',
          lowStockThreshold: 5.0,
          costPerUnit: 68,
          supplier: 'Heritage Dairies',
          status: 'in_stock',
          isActive: true,
        });

        const oatMilk = await InventoryItemModel.create({
          cafeId: cafe.id,
          name: 'Barista Oat Milk (Oatly)',
          sku: 'ING-OAT-01',
          category: 'dairy',
          currentStock: 8.0,
          unit: 'l',
          lowStockThreshold: 2.0,
          costPerUnit: 195,
          supplier: 'Oatly India',
          status: 'in_stock',
          isActive: true,
        });

        const vanilla = await InventoryItemModel.create({
          cafeId: cafe.id,
          name: 'Madagascar Vanilla Syrup',
          sku: 'ING-SYR-01',
          category: 'syrup',
          currentStock: 3.5,
          unit: 'l',
          lowStockThreshold: 1.0,
          costPerUnit: 480,
          supplier: 'Monin Gourmet',
          status: 'in_stock',
          isActive: true,
        });

        const hotCups = await InventoryItemModel.create({
          cafeId: cafe.id,
          name: 'Compostable Hot Cups (250ml)',
          sku: 'ING-CUP-250',
          category: 'packaging',
          currentStock: 180,
          unit: 'pcs',
          lowStockThreshold: 30,
          costPerUnit: 4.5,
          supplier: 'EcoCup Packaging',
          status: 'in_stock',
          isActive: true,
        });

        const coldCups = await InventoryItemModel.create({
          cafeId: cafe.id,
          name: 'Compostable Cold Cups (350ml)',
          sku: 'ING-CUP-350',
          category: 'packaging',
          currentStock: 140,
          unit: 'pcs',
          lowStockThreshold: 30,
          costPerUnit: 6.0,
          supplier: 'EcoCup Packaging',
          status: 'in_stock',
          isActive: true,
        });

        const sourdough = await InventoryItemModel.create({
          cafeId: cafe.id,
          name: 'Artisan Sourdough Loaf',
          sku: 'ING-BRD-01',
          category: 'bakery',
          currentStock: 15,
          unit: 'pcs',
          lowStockThreshold: 3,
          costPerUnit: 85,
          supplier: 'Artisan Bakeries',
          status: 'in_stock',
          isActive: true,
        });

        const mozzarella = await InventoryItemModel.create({
          cafeId: cafe.id,
          name: 'Buffalo Mozzarella Block',
          sku: 'ING-CHZ-01',
          category: 'dairy',
          currentStock: 4.0,
          unit: 'kg',
          lowStockThreshold: 1.0,
          costPerUnit: 620,
          supplier: 'Artisan Fromagerie',
          status: 'in_stock',
          isActive: true,
        });

        // Seed initial Stock Ledger entries
        if (StockLedgerModel && StockLedgerModel.bulkCreate) {
          await StockLedgerModel.bulkCreate([
            {
              cafeId: cafe.id,
              inventoryItemId: beans.id,
              changeType: 'purchase_restock',
              quantityDelta: 12.5,
              stockBefore: 0,
              stockAfter: 12.5,
              notes: 'Initial stock intake (Arabica Roastery lot #091)',
              recordedBy: 'Demo Owner',
            },
            {
              cafeId: cafe.id,
              inventoryItemId: milk.id,
              changeType: 'purchase_restock',
              quantityDelta: 24.0,
              stockBefore: 0,
              stockAfter: 24.0,
              notes: 'Daily morning fresh farm dairy delivery',
              recordedBy: 'Aditi Sharma (Manager)',
            },
          ]);
        }

        // Map Recipes to Menu Items
        if (RecipeItemModel && RecipeItemModel.bulkCreate && MenuItemModel && MenuItemModel.findAll) {
          const menuList = await MenuItemModel.findAll({ where: { cafeId: cafe.id } });
          const capItem = menuList.find(m => m.name.toLowerCase().includes('cappuccino'));
          const espressoItem = menuList.find(m => m.name.toLowerCase().includes('espresso'));
          const latteItem = menuList.find(m => m.name.toLowerCase().includes('latte'));
          const paniniItem = menuList.find(m => m.name.toLowerCase().includes('panini') || m.name.toLowerCase().includes('croissant'));

          if (capItem) {
            await RecipeItemModel.bulkCreate([
              { cafeId: cafe.id, menuItemId: capItem.id, inventoryItemId: beans.id, quantityRequired: 18, unit: 'g' },
              { cafeId: cafe.id, menuItemId: capItem.id, inventoryItemId: milk.id, quantityRequired: 180, unit: 'ml' },
              { cafeId: cafe.id, menuItemId: capItem.id, inventoryItemId: hotCups.id, quantityRequired: 1, unit: 'pcs' },
            ]);
          }

          if (espressoItem) {
            await RecipeItemModel.bulkCreate([
              { cafeId: cafe.id, menuItemId: espressoItem.id, inventoryItemId: beans.id, quantityRequired: 18, unit: 'g' },
              { cafeId: cafe.id, menuItemId: espressoItem.id, inventoryItemId: hotCups.id, quantityRequired: 1, unit: 'pcs' },
            ]);
          }

          if (latteItem) {
            await RecipeItemModel.bulkCreate([
              { cafeId: cafe.id, menuItemId: latteItem.id, inventoryItemId: beans.id, quantityRequired: 20, unit: 'g' },
              { cafeId: cafe.id, menuItemId: latteItem.id, inventoryItemId: milk.id, quantityRequired: 200, unit: 'ml' },
              { cafeId: cafe.id, menuItemId: latteItem.id, inventoryItemId: vanilla.id, quantityRequired: 20, unit: 'ml' },
              { cafeId: cafe.id, menuItemId: latteItem.id, inventoryItemId: coldCups.id, quantityRequired: 1, unit: 'pcs' },
            ]);
          }

          if (paniniItem) {
            await RecipeItemModel.bulkCreate([
              { cafeId: cafe.id, menuItemId: paniniItem.id, inventoryItemId: sourdough.id, quantityRequired: 1, unit: 'pcs' },
              { cafeId: cafe.id, menuItemId: paniniItem.id, inventoryItemId: mozzarella.id, quantityRequired: 60, unit: 'g' },
            ]);
          }
        }
      }
    }

    if (BrandModel && DeliveryChannelModel && WhatsAppConfigModel && cafe) {
      let [brand] = await BrandModel.findOrCreate({
        where: { slug: 'gusstora-roasters-chain' },
        defaults: {
          name: 'Gusstora Roasters & Co.',
          slug: 'gusstora-roasters-chain',
          headquarters: 'Bandra West, Mumbai',
          settings: { taxNumber: '27AABCU9603R1ZM' },
        },
      });

      if (!cafe.brandId) {
        await cafe.update({ brandId: brand.id });
      }

      // Seed second outlet under brand for demo
      await CafeModel.findOrCreate({
        where: { slug: 'gusstora-airport-t2' },
        defaults: {
          name: 'Gusstora Express - Airport T2',
          slug: 'gusstora-airport-t2',
          address: 'Terminal 2 Departures, CSIA Mumbai',
          phone: '9876500099',
          tables: 8,
          brandId: brand.id,
          brandColor: '#ea580c',
          tagline: 'Grab & Go Artisanal Specialty Brews',
        },
      });

      // Seed Delivery Channels for main café
      const channels = [
        { channel: 'zomato', commissionRate: 18.0, storeId: 'ZOM-BANDRA-01', autoAccept: true },
        { channel: 'swiggy', commissionRate: 18.0, storeId: 'SWG-BANDRA-01', autoAccept: true },
        { channel: 'urbanpiper', commissionRate: 12.0, storeId: 'UP-BANDRA-HUB', autoAccept: true },
      ];
      for (const ch of channels) {
        await DeliveryChannelModel.findOrCreate({
          where: { cafeId: cafe.id, channel: ch.channel },
          defaults: {
            status: 'online',
            ...ch,
          },
        });
      }

      // Seed WhatsApp Cloud Config
      await WhatsAppConfigModel.findOrCreate({
        where: { cafeId: cafe.id },
        defaults: {
          status: 'mock',
          phoneNumberId: '109847291823901',
          wabaId: 'waba_991827461928',
          autoOrderConfirmation: true,
          autoOrderReady: true,
          autoLoyaltyAlerts: true,
          webhookVerifyToken: 'gusstora_wa_verify_2026',
        },
      });
    }
  }
}

export async function seed() {
  await ensureSeedData();
}

