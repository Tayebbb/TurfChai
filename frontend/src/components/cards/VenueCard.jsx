import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Photo } from '@/components/ui/Photo';
import { Rating } from '@/components/ui/Stars';
import { Verified } from '@/components/ui/Tags';
import { formatBdt } from '@/utils/format';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';

/**
 * Venue tile used on the landing page, player home and Explore.
 * `compact` shrinks the photo for horizontal scrollers.
 */
function VenueCardBase({ venue, compact = false, className }) {
    const {
        id,
        name,
        photoVariant,
        imgUrl,
        photos,
        photo,
        glyph = '⚽',
        area,
        distanceKm,
        rating,
        reviewCount,
        price,
        priceUnit,
        nextSlot,
        verified,
        badges = [],
    } = venue;

    const resolvedImgUrl = imgUrl || photos?.[0] || photo;

    return (
        <Link
            className={cn('venue-card', className)}
            to={paths.player.venue(id)}
            style={{ textDecoration: 'none', color: 'var(--text)' }}
        >
            <Photo
                photos={photos}
                imgUrl={resolvedImgUrl}
                variant={photoVariant}
                glyph={glyph}
                height={compact ? 120 : undefined}
            />
            <div className="body">
                <div className="name">
                    {name}
                    {verified ? <Verified label={compact ? '' : 'Verified'} /> : null}
                    {badges.map((badge) => (
                        <Badge key={badge.label} tone={badge.tone} dot={false}>
                            {badge.label}
                        </Badge>
                    ))}
                </div>
                <div className={compact ? 'subtle' : 'row-wrap subtle'}>
                    {/* distance only exists on a near-me search; price only once a venue has pricing */}
                    {distanceKm != null ? (compact ? `${distanceKm} km · ` : `${area} · ${distanceKm} km `) : (compact ? '' : `${area} `)}
                    <Rating value={rating} count={compact ? undefined : reviewCount} />
                </div>
                <div className="between">
                    {price ? (
                        compact ? (
                            <b className="num">{formatBdt(price)}</b>
                        ) : (
                            <span className="price">
                                <b>{formatBdt(price)}</b>
                                <span className="subtle">/{priceUnit}</span>
                            </span>
                        )
                    ) : (
                        <span className="subtle small">Price on request</span>
                    )}
                    {nextSlot ? (
                        <span className="slot-pill">{compact ? nextSlot : `Next: ${nextSlot}`}</span>
                    ) : null}
                </div>
            </div>
        </Link>
    );
}

export const VenueCard = memo(VenueCardBase);
