import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { MusicsPage } from "./pages/MusicsPage";
import { MusicUploadPage } from "./pages/MusicUploadPage";
import { PlaylistDetailPage } from "./pages/PlaylistDetailPage";
import { PlaylistNewPage } from "./pages/PlaylistNewPage";
import { PlaylistsPage } from "./pages/PlaylistsPage";
import { useAuthStore } from "./store/auth";

export function App() {
  // Resolve the session once on load (and after returning from OAuth).
  useEffect(() => {
    void useAuthStore.getState().fetchMe();
  }, []);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="musics" element={<MusicsPage />} />
        <Route path="musics/new" element={<MusicUploadPage />} />
        <Route path="playlists" element={<PlaylistsPage />} />
        <Route path="playlists/new" element={<PlaylistNewPage />} />
        <Route path="playlists/:id" element={<PlaylistDetailPage />} />
      </Route>
    </Routes>
  );
}
