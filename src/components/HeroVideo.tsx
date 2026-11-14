import { useEffect, useRef, useState } from 'react';
import backgroundVideo from '../../assets/videos/takeoff-tokyo-background-video.mp4';
import poster from '../../assets/images/hero-poster.webp';

const motionPreference = '(prefers-reduced-motion: reduce)';

export function HeroVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia(motionPreference).matches,
  );

  useEffect(() => {
    const preference = window.matchMedia(motionPreference);
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (reducedMotion) video.current?.pause();
    else void video.current?.play().catch(() => {});
  }, [reducedMotion]);

  return (
    <video
      ref={video}
      className="hero-video"
      autoPlay={!reducedMotion}
      muted
      loop
      playsInline
      poster={poster}
      preload={reducedMotion ? 'none' : 'metadata'}
      aria-hidden="true"
    >
      <source src={backgroundVideo} type="video/mp4" />
    </video>
  );
}
