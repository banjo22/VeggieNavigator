import MapView, { Marker, UrlTile, type Region } from "react-native-maps";
import { Platform, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";
import type { CommunitySpot } from "../types";

export function SpotMap({
  spots,
  selectedId,
  userLocation,
  onSelect,
}: {
  spots: CommunitySpot[];
  selectedId: number | null;
  userLocation?: { latitude: number; longitude: number } | null;
  onSelect: (id: number) => void;
}) {
  const first = spots[0];
  const close = Boolean(first || userLocation);
  const initial: Region = {
    latitude: userLocation?.latitude ?? first?.lat ?? 51.1657,
    longitude: userLocation?.longitude ?? first?.lng ?? 10.4515,
    latitudeDelta: close ? 0.08 : 7,
    longitudeDelta: close ? 0.08 : 7,
  };
  return (
    <View style={s.frame}>
      <MapView
        key={`${initial.latitude.toFixed(3)}-${initial.longitude.toFixed(3)}`}
        style={StyleSheet.absoluteFill}
        initialRegion={initial}
        mapType={Platform.OS === "android" ? "none" : "standard"}
        showsUserLocation={Boolean(userLocation)}
        showsMyLocationButton
        loadingEnabled
        loadingBackgroundColor={colors.primarySoft}
        loadingIndicatorColor={colors.primary}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        {spots.map((spot) => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.lat, longitude: spot.lng }}
            title={spot.name}
            description={spot.place}
            pinColor={spot.id === selectedId ? colors.danger : colors.primary}
            onPress={() => onSelect(spot.id)}
          />
        ))}
      </MapView>
      <View pointerEvents="none" style={s.attribution}>
        <Text style={s.attributionText}>© OpenStreetMap</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  frame: {
    width: "100%",
    height: 350,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.primarySoft,
  },
  attribution: {
    position: "absolute",
    right: 6,
    bottom: 5,
    backgroundColor: "rgba(255,255,255,.86)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attributionText: { fontSize: 9, color: colors.textMuted },
});
