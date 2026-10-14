import React, { useState, useMemo } from 'react';
import { 
  X, 
  Info, 
  TrendingUp, 
  Star, 
  ThumbsUp, 
  Check, 
  Plus, 
  MessageSquare, 
  ChevronRight,
  Sparkles,
  ShoppingBag,
  Utensils,
  AlertCircle
} from 'lucide-react';
import { Vendor, Order } from '../../types/database';
import { useDelivery } from '../../context/DeliveryContext';

interface CustomerRestaurantReviewsModalProps {
  vendor: Vendor;
  onClose: () => void;
  onNavigateToOrders?: () => void;
}

interface ReviewItem {
  id: string;
  userName: string;
  isTopReviewer?: boolean;
  rating: number; // 1 to 5
  timeAgo: string;
  comment: string;
  mentioned_items?: string[];
  helpfulCount: number;
  hasVotedHelpful?: boolean;
  createdAt: number;
  orderCode?: string;
}

export const CustomerRestaurantReviewsModal: React.FC<CustomerRestaurantReviewsModalProps> = ({
  vendor,
  onClose,
  onNavigateToOrders
}) => {
  const { reviews: contextReviews, orders, currentUser, addOrderReview } = useDelivery();

  // Find unreviewed delivered orders for this vendor
  const unreviewedDeliveredOrders = useMemo(() => {
    return (orders || []).filter(o => 
      o.vendor_id === vendor.id && 
      o.status === 'delivered' &&
      !contextReviews.some(r => r.order_code === o.order_code || (r.order_id && r.order_id === o.id))
    );
  }, [orders, vendor.id, contextReviews]);

  // Initial base reviews (empty by default, loaded only from persistent reviews/database)
  const [baseReviews, setBaseReviews] = useState<ReviewItem[]>(() => {
    const storageKey = `foodiplace_customer_reviews_${vendor.id}`;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('Error reading saved reviews:', e);
      }
    }
    return [];
  });

  // Convert real database reviews for this vendor into ReviewItem format
  const reviews = useMemo(() => {
    const dbReviewsForVendor = (contextReviews || []).filter(r => r.vendor_id === vendor.id);
    const dbItems: ReviewItem[] = dbReviewsForVendor.map(r => {
      // Calculate relative time
      const diffMs = Date.now() - new Date(r.created_at).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 3600 * 24));
      const timeStr = diffDays <= 0 ? 'Today' : diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;

      return {
        id: r.id,
        userName: r.customer_name || 'Customer',
        rating: r.rating,
        timeAgo: timeStr,
        comment: r.comment,
        mentioned_items: r.mentioned_items || [],
        helpfulCount: 0,
        createdAt: new Date(r.created_at).getTime(),
        orderCode: r.order_code
      };
    });

    const dbOrderCodes = new Set(dbItems.map(d => d.orderCode).filter(Boolean));
    const merged = [...dbItems, ...baseReviews.filter(b => !dbOrderCodes.has(b.orderCode))];
    return merged;
  }, [contextReviews, vendor.id, baseReviews]);

  // Filter state
  const [activeFilter, setActiveFilter] = useState<'top' | 'newest' | 'highest' | 'lowest'>('top');

  // Modal dialog states
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isNoOrderModalOpen, setIsNoOrderModalOpen] = useState(false);

  // Write review form state (Strictly attached to a delivered order)
  const [isWriteReviewOpen, setIsWriteReviewOpen] = useState(false);
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<Order | null>(null);
  const [selectedMentionedDishes, setSelectedMentionedDishes] = useState<string[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    const list = [...reviews];
    if (activeFilter === 'newest') {
      return list.sort((a, b) => b.createdAt - a.createdAt);
    }
    if (activeFilter === 'highest') {
      return list.sort((a, b) => b.rating - a.rating || b.createdAt - a.createdAt);
    }
    if (activeFilter === 'lowest') {
      return list.sort((a, b) => a.rating - b.rating || b.createdAt - a.createdAt);
    }
    return list.sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0) || b.rating - a.rating);
  }, [reviews, activeFilter]);

  // Dynamic Rating calculations computed from actual reviews
  const avgRatingDisplay = useMemo(() => {
    if (reviews.length === 0) {
      return (vendor.rating && vendor.rating > 0) ? vendor.rating.toFixed(1) : '0';
    }
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews, vendor.rating]);

  // Dynamic distribution percentages calculated from real reviews
  const distributionPercentages = useMemo<Record<number, number>>(() => {
    if (reviews.length === 0) {
      return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    }
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      const rounded = Math.min(5, Math.max(1, Math.round(r.rating)));
      counts[rounded] = (counts[rounded] || 0) + 1;
    });
    return {
      5: Math.round((counts[5] / reviews.length) * 100),
      4: Math.round((counts[4] / reviews.length) * 100),
      3: Math.round((counts[3] / reviews.length) * 100),
      2: Math.round((counts[2] / reviews.length) * 100),
      1: Math.round((counts[1] / reviews.length) * 100)
    };
  }, [reviews]);

  const handleOpenReviewAction = () => {
    if (unreviewedDeliveredOrders.length > 0) {
      const targetOrder = unreviewedDeliveredOrders[0];
      setSelectedOrderForReview(targetOrder);
      setNewRating(5);
      setNewComment('');
      setNewUserName(currentUser?.name || targetOrder.customer_name || '');
      setSelectedMentionedDishes((targetOrder.items || []).map(i => i.item_name));
      setIsWriteReviewOpen(true);
    } else {
      setIsNoOrderModalOpen(true);
    }
  };

  // Submit verified review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setIsSubmitting(true);

    try {
      if (selectedOrderForReview) {
        await addOrderReview({
          vendor_id: vendor.id,
          order_id: selectedOrderForReview.id,
          order_code: selectedOrderForReview.order_code,
          customer_id: currentUser?.id,
          customer_name: newUserName.trim() || currentUser?.name || selectedOrderForReview.customer_name || 'Customer',
          customer_phone: currentUser?.phone || selectedOrderForReview.customer_phone,
          rating: newRating,
          comment: newComment.trim(),
          mentioned_items: selectedMentionedDishes
        });
      }
      setIsWriteReviewOpen(false);
      setSelectedOrderForReview(null);
      setNewComment('');
      setSelectedMentionedDishes([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle helpful vote
  const toggleHelpful = (id: string) => {
    // Helpful vote local handling
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#f8f9fa] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200 font-sans select-none">
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] text-slate-900 pb-20 flex flex-col">
        {/* 
          ========================================================================
          TOP HEADER BAR
          ========================================================================
        */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md z-30 px-4 pt-3.5 pb-3 flex items-center justify-between border-b border-slate-100 shadow-2xs">
          <div className="flex items-center space-x-3 truncate">
            {/* ✕ Close button */}
            <button
              onClick={onClose}
              className="p-1 text-slate-800 hover:text-slate-950 transition cursor-pointer active:scale-90 shrink-0"
              title="Close"
              aria-label="Close"
            >
              <X className="w-6 h-6 stroke-[2.4]" />
            </button>

            {/* Title & Restaurant Outlets Subtitle */}
            <div className="truncate">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                Ratings & Reviews
              </h1>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                {vendor.name} - {vendor.zone ? vendor.zone.replace(' Zone', '') : 'Chittagong'}
              </p>
            </div>
          </div>

          {/* ⓘ Info Button */}
          <button
            onClick={() => setIsInfoModalOpen(true)}
            className="p-1.5 text-slate-700 hover:text-slate-950 transition cursor-pointer shrink-0"
            title="Rating Info"
            aria-label="Info"
          >
            <Info className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* 
          ========================================================================
          HIGHLIGHTS BANNER
          ========================================================================
        */}
        <div className="px-4 pt-3">
          <div className="bg-[#fff1f2] border border-[#ffe4e6] rounded-2xl p-3.5 flex items-center space-x-2.5 shadow-2xs">
            <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
            <p className="text-xs sm:text-[13px] font-black text-slate-900 tracking-tight leading-snug">
              This restaurant is getting better reviews!
            </p>
          </div>
        </div>

        {/* 
          ========================================================================
          OVERALL RATING CARD
          ========================================================================
        */}
        <div className="mx-4 mt-3 bg-white rounded-3xl border border-slate-100 shadow-2xs p-5">
          <div className="grid grid-cols-2 gap-4 items-center">
            {/* Left Column: Big score + stars */}
            <div className="space-y-1.5">
              <div className="text-4xl sm:text-5xl font-black text-slate-900 font-mono tracking-tight leading-none">
                {avgRatingDisplay}
              </div>

              {/* 5 Amber Stars */}
              <div className="flex items-center space-x-1 pt-1">
                {[1, 2, 3, 4, 5].map((starIdx) => (
                  <Star
                    key={starIdx}
                    className={`w-4 h-4 ${
                      starIdx <= Math.round(Number(avgRatingDisplay))
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-slate-200 text-slate-200'
                    }`}
                  />
                ))}
              </div>

              <div className="text-xs font-semibold text-slate-500 pt-0.5">
                {reviews.length === 0 ? 'No ratings yet' : `All ratings (${reviews.length})`}
              </div>
            </div>

            {/* Right Column: 5 ★ down to 1 ★ Distribution Bars */}
            <div className="space-y-1.5 pl-2">
              {[5, 4, 3, 2, 1].map((stars) => {
                const pct = distributionPercentages[stars] || 0;
                return (
                  <div key={stars} className="flex items-center space-x-2 text-xs">
                    <span className="font-bold text-slate-700 w-3 text-right">{stars}</span>
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    
                    {/* Progress Bar Track */}
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 
          ========================================================================
          SECTION TITLE: "Reviews" & Rate Order Button
          ========================================================================
        */}
        <div className="px-4 mt-6 mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Reviews
          </h2>
          <button
            onClick={handleOpenReviewAction}
            className="text-xs font-black text-rose-600 hover:text-rose-700 flex items-center space-x-1 cursor-pointer active:scale-95 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-full border border-rose-200 transition"
          >
            <Star className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            <span>{unreviewedDeliveredOrders.length > 0 ? `Rate Order #${unreviewedDeliveredOrders[0].order_code}` : 'Rate Order'}</span>
          </button>
        </div>

        {/* 
          ========================================================================
          HORIZONTAL FILTER PILLS
          ========================================================================
        */}
        <div className="px-4 mb-4 overflow-x-auto scrollbar-none flex items-center space-x-2.5 pb-1">
          <button
            onClick={() => setActiveFilter('top')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer shadow-2xs ${
              activeFilter === 'top'
                ? 'bg-slate-900 text-white font-black'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Top reviews
          </button>

          <button
            onClick={() => setActiveFilter('newest')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer shadow-2xs ${
              activeFilter === 'newest'
                ? 'bg-slate-900 text-white font-black'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Newest
          </button>

          <button
            onClick={() => setActiveFilter('highest')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer shadow-2xs ${
              activeFilter === 'highest'
                ? 'bg-slate-900 text-white font-black'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Highest rating
          </button>

          <button
            onClick={() => setActiveFilter('lowest')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer shadow-2xs ${
              activeFilter === 'lowest'
                ? 'bg-slate-900 text-white font-black'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Lowest rating
          </button>
        </div>

        {/* 
          ========================================================================
          REVIEWS LIST
          ========================================================================
        */}
        <div className="space-y-3 px-4">
          {filteredReviews.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs p-8 text-center space-y-2">
              <Star className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-sm text-slate-800">No reviews yet for this restaurant</p>
              <p className="text-xs text-slate-400">
                Customer reviews submitted after order delivery will appear here.
              </p>
            </div>
          ) : (
            filteredReviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-white rounded-3xl border border-slate-100 shadow-2xs p-4 space-y-2.5"
              >
                {/* Reviewer Name & Top reviewer badge */}
                <div className="flex items-center space-x-2">
                  <span className="font-black text-sm text-slate-900 tracking-tight">
                    {rev.userName}
                  </span>

                  {rev.isTopReviewer && (
                    <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[10px] font-black tracking-tight">
                      Top reviewer
                    </span>
                  )}

                  {rev.orderCode && (
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                      #{rev.orderCode}
                    </span>
                  )}
                </div>

                {/* Stars & Time Ago */}
                <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                  <div className="flex items-center space-x-0.5">
                    {[1, 2, 3, 4, 5].map((starIdx) => (
                      <Star
                        key={starIdx}
                        className={`w-3.5 h-3.5 ${
                          starIdx <= rev.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-slate-200 text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span>·</span>
                  <span className="text-slate-500 font-medium">{rev.timeAgo}</span>
                </div>

                {/* Comment text */}
                <p className="text-xs sm:text-[13px] text-slate-800 font-medium leading-relaxed">
                  {rev.comment}
                </p>

                {/* Mentioned dishes tags */}
                {rev.mentioned_items && rev.mentioned_items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {rev.mentioned_items.map((it, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 text-[11px] font-bold border border-amber-200/70"
                      >
                        <Utensils className="w-3 h-3 text-amber-600" />
                        <span>{it}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 
        ========================================================================
        MODAL: VERIFIED ORDER REQUIRED (When user has no delivered order)
        ========================================================================
      */}
      {isNoOrderModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-5 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 stroke-[2.3]" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-black text-slate-900 text-base">Delivered Order Required</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                To guarantee authentic ratings, reviews can only be submitted after placing and receiving an order from <span className="font-bold text-slate-900">{vendor.name}</span>.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setIsNoOrderModalOpen(false);
                  onClose();
                }}
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-xs"
              >
                Order Food from {vendor.name}
              </button>

              {onNavigateToOrders && (
                <button
                  onClick={() => {
                    setIsNoOrderModalOpen(false);
                    onNavigateToOrders();
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  View My Order History
                </button>
              )}

              <button
                onClick={() => setIsNoOrderModalOpen(false)}
                className="w-full py-1 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        MODAL: RATE & REVIEW DELIVERED ORDER
        ========================================================================
      */}
      {isWriteReviewOpen && selectedOrderForReview && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <h3 className="font-black text-slate-900 text-base">Rate Your Order</h3>
              </div>
              <button
                onClick={() => setIsWriteReviewOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Order summary */}
            <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/70 space-y-1 text-xs">
              <div className="flex justify-between font-bold text-slate-800">
                <span className="truncate">{vendor.name}</span>
                <span className="font-mono text-amber-800">#{selectedOrderForReview.order_code}</span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {(selectedOrderForReview.items || []).map(i => `${i.quantity}x ${i.item_name}`).join(', ')}
              </p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-3.5">
              {/* Star selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">How was your food & service?</label>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setNewRating(star)}
                      className="p-1 cursor-pointer transition active:scale-90"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= newRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-slate-100 text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-black text-slate-800 ml-2">
                    {newRating} / 5 Stars
                  </span>
                </div>
              </div>

              {/* Mention ordered dishes */}
              {selectedOrderForReview.items && selectedOrderForReview.items.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Mention Dishes in Review (Tap to select):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedOrderForReview.items.map((it, idx) => {
                      const isSelected = selectedMentionedDishes.includes(it.item_name);
                      return (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => {
                            setSelectedMentionedDishes(prev => 
                              prev.includes(it.item_name)
                                ? prev.filter(name => name !== it.item_name)
                                : [...prev, it.item_name]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer active:scale-95 ${
                            isSelected
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <span>{it.item_name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Comment text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Your Review *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Tell us about the food taste, temperature, packaging..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWriteReviewOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newComment.trim()}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer transition active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        MODAL: RATING INFO
        ========================================================================
      */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Info className="w-5 h-5 text-rose-600" />
                <h3 className="font-black text-slate-900 text-base">Ratings & Reviews Policy</h3>
              </div>
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
              <p>
                <strong>Authentic Orders:</strong> Only customers who have placed and received an order from <span className="font-bold text-slate-900">{vendor.name}</span> can submit verified reviews.
              </p>
              <p>
                <strong>Dish Mentions:</strong> Customers can highlight specific dishes they enjoyed from their delivered order.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl transition cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
