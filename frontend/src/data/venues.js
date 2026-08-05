/**
 * Venue rows rendered across the player Home, Explore and Venue screens.
 * Mirrors the Dhaka sample data used by the HTML prototype.
 */

/** Horizontal "Available near you tonight" scroller on the player home. */
export const nearbyVenues = [
  {
    id: 'kick-off-arena',
    name: 'Kick Off Arena',
    glyph: '⚽',
    distanceKm: 1.2,
    rating: 4.8,
    price: 2500,
    nextSlot: '7:00 PM',
    verified: true,
  },
  {
    id: 'greenturf-mohammadpur',
    name: 'GreenTurf',
    photoVariant: 'alt1',
    glyph: '⚽',
    distanceKm: 2.8,
    rating: 4.6,
    price: 1800,
    nextSlot: '8:30 PM',
    verified: true,
  },
  {
    id: 'shuttlezone-lalmatia',
    name: 'ShuttleZone Lalmatia',
    photoVariant: 'alt2',
    glyph: '🏸',
    distanceKm: 1.9,
    rating: 4.5,
    price: 600,
    nextSlot: '9:00 PM',
    verified: false,
  },
  {
    id: 'mirpur-sports-city',
    name: 'Mirpur Sports City',
    photoVariant: 'alt3',
    glyph: '⚽',
    distanceKm: 5.1,
    rating: 4.7,
    price: 2200,
    nextSlot: '10:00 PM',
    verified: true,
  },
];

/** Full-width result cards on Explore. `amenities[].icon` keys the SVG map in ExplorePage. */
export const exploreVenues = [
  {
    id: 'kick-off-arena',
    name: 'Kick Off Arena',
    verified: true,
    meta: 'Road 27, Dhanmondi \u00b7 1.2 km',
    rating: '4.8',
    reviews: '(214)',
    ratingLabel: 'Rated 4.8 out of 5, 214 reviews',
    cardLabel: 'Kick Off Arena, Road 27 Dhanmondi, 1.2 km, from ৳2,500',
    price: '৳2,500',
    priceUnit: '/ 90 min',
    slots: ['7:00', '8:30', '10:00'],
    amenities: [
      { icon: 'ball', label: '7-a-side', title: '5-a-side & 7-a-side' },
      { icon: 'zap', label: 'Floodlit', title: 'Floodlights' },
      { icon: 'parking', label: 'Parking', title: 'Free parking' },
      { icon: 'user', label: 'Changing', title: 'Changing room' },
    ],
  },
  {
    id: 'greenturf-mohammadpur',
    name: 'GreenTurf Mohammadpur',
    photoVariant: 'alt1',
    verified: true,
    promo: 'Buy 5 get 1 free',
    meta: 'Ring Road, Mohammadpur \u00b7 2.8 km',
    rating: '4.6',
    reviews: '(128)',
    ratingLabel: 'Rated 4.6, 128 reviews',
    cardLabel: 'GreenTurf Mohammadpur, Ring Road, 2.8 km, from ৳1,800',
    price: '৳1,800',
    priceUnit: '/ 60 min',
    slots: ['8:30', '9:30'],
    amenities: [
      { icon: 'ball', label: '6-a-side', title: '6-a-side' },
      { icon: 'zap', label: 'Floodlit', title: 'Floodlights' },
      { icon: 'user', label: 'Changing', title: 'Changing room' },
    ],
  },
  {
    id: 'lalmatia-play-zone',
    name: 'Lalmatia Play Zone',
    photoVariant: 'alt2',
    verified: false,
    meta: 'Block D, Lalmatia \u00b7 1.9 km',
    rating: '4.3',
    reviews: '(64)',
    ratingLabel: 'Rated 4.3, 64 reviews',
    cardLabel: 'Lalmatia Play Zone, Block D, 1.9 km, from ৳1,500',
    price: '৳1,500',
    priceUnit: '/ 60 min',
    slots: ['7:30', '9:00', '10:30'],
    amenities: [
      { icon: 'ball', label: '5-a-side', title: '5-a-side' },
      { icon: 'indoor', label: 'Indoor', title: 'Indoor facility' },
      { icon: 'users', label: 'Youth', title: 'Youth-friendly' },
    ],
  },
  {
    id: 'mirpur-sports-city',
    name: 'Mirpur Sports City',
    photoVariant: 'alt3',
    verified: true,
    promo: '20% off after 10 PM',
    meta: 'Mirpur DOHS \u00b7 5.1 km',
    rating: '4.7',
    reviews: '(301)',
    ratingLabel: 'Rated 4.7, 301 reviews',
    cardLabel: 'Mirpur Sports City, Mirpur DOHS, 5.1 km, from ৳2,200',
    price: '৳2,200',
    priceUnit: '/ 90 min',
    slots: ['10:00', '11:30'],
    amenities: [
      { icon: 'ball', label: '11-a-side', title: '7-a-side & 11-a-side' },
      { icon: 'zap', label: 'Floodlit', title: 'Floodlights' },
      { icon: 'coffee', label: 'Cafeteria', title: 'Cafeteria' },
      { icon: 'parking', label: 'Parking', title: 'Parking' },
    ],
  },
];

/** Price bubbles floating over the Explore map placeholder. */
export const exploreMapPins = [
  { id: 'pin-2500', price: '৳2,500', hot: true, top: '32%', left: '38%' },
  { id: 'pin-1500', price: '৳1,500', top: '22%', left: '64%' },
  { id: 'pin-1800', price: '৳1,800', top: '55%', left: '26%' },
  { id: 'pin-2200', price: '৳2,200', top: '66%', left: '58%' },
  { id: 'pin-3200', price: '৳3,200', top: '44%', left: '74%' },
];

/** "Similar venues nearby" strip at the bottom of the venue detail page. */
export const similarVenues = [
  { id: 'greenturf-mohammadpur', name: 'GreenTurf', photoVariant: 'alt1', distance: '2.8 km', price: '৳1,800' },
  { id: 'lalmatia-play-zone', name: 'Lalmatia Play Zone', photoVariant: 'alt2', distance: '1.9 km', price: '৳1,500' },
  { id: 'mirpur-sports-city', name: 'Mirpur Sports City', photoVariant: 'alt3', distance: '5.1 km', price: '৳2,200' },
];
