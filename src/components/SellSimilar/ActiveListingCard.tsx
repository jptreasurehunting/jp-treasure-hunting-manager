import React from 'react';
import { ActiveListing } from '../../types/sellSimilar';

interface ActiveListingCardProps {
  listing: ActiveListing;
  onLaunch: (itemId: string, title?: string) => void;
  isCompact?: boolean;
}

export const ActiveListingCard: React.FC<ActiveListingCardProps> = ({
  listing,
  onLaunch,
  isCompact = false
}) => {
  return (
    <div className={`active-listing-card ${isCompact ? 'compact' : ''}`}>
      <div className="listing-image-box">
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="listing-thumb"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150&auto=format&fit=crop&q=80';
          }}
        />
        <span className="listing-status-pill">{listing.status}</span>
      </div>

      <div className="listing-info-body">
        <div className="listing-header-meta">
          <span className="listing-item-id">Item ID: <strong>{listing.itemId}</strong></span>
          {listing.sku && <span className="listing-sku">SKU: {listing.sku}</span>}
        </div>

        <h4 className="listing-title" title={listing.title}>
          {listing.title}
        </h4>

        <div className="listing-footer-meta">
          <div className="listing-price-tag">
            <span className="price-label">価格:</span>
            <span className="price-amount">${listing.price.toFixed(2)} {listing.currency}</span>
          </div>

          <span className="listing-category">{listing.category}</span>
        </div>
      </div>

      <div className="listing-action">
        <button
          type="button"
          className="btn-sell-similar-launch"
          onClick={() => onLaunch(listing.itemId, listing.title)}
          title="この商品の類似出品画面を開きます"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>Sell Similar</span>
        </button>
      </div>
    </div>
  );
};
