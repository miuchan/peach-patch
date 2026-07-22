#pragma once

#include <rack.hpp>

inline bool fixtureAnyConnected(std::vector<Input>* ports) {
  return !ports->empty() && (*ports)[0].isConnected();
}

union FixtureSimdUnion {
  simd::float_4 lanes[2];
  float scalars[8];
};
