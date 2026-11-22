import { useNavigate } from "react-router";

export function NavBackButton({ fallback = "/" }: { fallback?: string }) {
  const navigate = useNavigate();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  }

  return (
    <button type="button" className="nav-back-btn" onClick={goBack} aria-label="Go back" title="Back">
      ←
    </button>
  );
}
